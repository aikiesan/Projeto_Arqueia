import {
  CHECK_IN_EARLY_TOLERANCE_MINUTES,
  CHECK_IN_LOOKUP_WINDOW_HOURS,
  equipmentSchema,
  parseQrCode,
  scheduleResponseSchema,
  type Equipment,
  type ParsedQrCode,
  type QrEntityType,
} from '@arqueia/contracts';

// `parseQrCode` vive em `@arqueia/contracts`: o servidor precisa ler a etiqueta
// exatamente como o cliente lê, senão os dois discordam sobre o que foi escaneado.
export { parseQrCode };
export type { ParsedQrCode, QrEntityType };

export type CheckInState =
  | 'ELIGIBLE'
  | 'IN_PROGRESS'
  | 'NOT_STARTED_YET'
  | 'OTHER_USER'
  | 'NONE';

export interface CheckInIntent {
  readonly state: CheckInState;
  readonly laboratoryId: string;
  readonly equipmentId: string;
  readonly reservationId?: string | undefined;
  readonly startsAt?: string | undefined;
  readonly endsAt?: string | undefined;
  readonly hint: string;
}

export interface ResolvedEntityPreview {
  readonly title: string;
  readonly subtitle?: string;
  readonly code: string;
  readonly status?: string;
  readonly balance?: string;
  readonly details?: readonly { label: string; value: string }[];
  readonly directActionLabel: string;
  readonly directActionHref: string;
  readonly secondaryActionLabel?: string;
  readonly secondaryActionHref?: string;
  readonly checkIn?: CheckInIntent | undefined;
}

export interface QrResolutionResult {
  readonly parsed: ParsedQrCode;
  readonly destinationUrl: string;
  readonly entity?: ResolvedEntityPreview;
}


/**
 * Resolve a etiqueta no servidor.
 *
 * Antes isto era uma varredura no cliente: até cinco páginas de 50 equipamentos
 * dentro de um laboratório *adivinhado*, o que falhava para equipamento de outro
 * laboratório ou além dos 250 primeiros. Agora o servidor resolve por id ou
 * código e decide a autorização pelo laboratório do próprio equipamento.
 */
async function resolveEquipmentByQr(
  rawCode: string,
  customFetch: typeof fetch,
): Promise<Equipment | null> {
  const response = await customFetch(
    `/api/equipment/by-qr?code=${encodeURIComponent(rawCode)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  if (!response?.ok) return null;

  const parsed = equipmentSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/**
 * Prevê se o usuário pode fazer check-in neste equipamento agora.
 *
 * Reaproveita `GET /api/scheduling` — que já devolve `isMine` e `canCheckIn` —
 * em vez de um endpoint novo. Duas ressalvas: `canCheckIn` vem do servidor sem
 * janela de tempo (é só `CONFIRMED && canControl`), por isso a janela é aplicada
 * aqui; e esta classificação é apenas indicativa — quem decide de verdade é a
 * API, que re-resolve a reserva sob transação.
 */
async function resolveCheckInIntent(
  equipmentId: string,
  laboratoryId: string,
  customFetch: typeof fetch,
): Promise<CheckInIntent | undefined> {
  const now = Date.now();
  const query = new URLSearchParams({
    laboratoryId,
    equipmentId,
    startsAt: new Date(now - 60 * 60_000).toISOString(),
    endsAt: new Date(now + CHECK_IN_LOOKUP_WINDOW_HOURS * 60 * 60_000).toISOString(),
  });

  const response = await customFetch(`/api/scheduling?${query.toString()}`, {
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return undefined;

  const parsed = scheduleResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return undefined;

  const toleranceMs = CHECK_IN_EARLY_TOLERANCE_MINUTES * 60_000;
  const items = parsed.data.items.filter((item) => item.type === 'RESERVATION');
  const base = { equipmentId, laboratoryId } as const;
  const at = (iso: string): string =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const running = items.find(
    (item) => item.isMine && item.status === 'IN_PROGRESS' && now < Date.parse(item.endsAt),
  );
  if (running) {
    return {
      ...base,
      endsAt: running.endsAt,
      hint: `Você já está usando este equipamento até ${at(running.endsAt)}.`,
      reservationId: running.reservationDetails?.reservationId,
      startsAt: running.startsAt,
      state: 'IN_PROGRESS',
    };
  }

  const eligible = items.find(
    (item) =>
      item.isMine &&
      item.status === 'CONFIRMED' &&
      now >= Date.parse(item.startsAt) - toleranceMs &&
      now < Date.parse(item.endsAt),
  );
  if (eligible) {
    return {
      ...base,
      endsAt: eligible.endsAt,
      hint: `Reserva das ${at(eligible.startsAt)} às ${at(eligible.endsAt)}.`,
      reservationId: eligible.reservationDetails?.reservationId,
      startsAt: eligible.startsAt,
      state: 'ELIGIBLE',
    };
  }

  const upcoming = items.find(
    (item) =>
      item.isMine && item.status === 'CONFIRMED' && now < Date.parse(item.startsAt) - toleranceMs,
  );
  if (upcoming) {
    return {
      ...base,
      hint: `Sua reserva começa às ${at(upcoming.startsAt)}. O check-in abre ${CHECK_IN_EARLY_TOLERANCE_MINUTES} minutos antes.`,
      reservationId: upcoming.reservationDetails?.reservationId,
      startsAt: upcoming.startsAt,
      state: 'NOT_STARTED_YET',
    };
  }

  const occupied = items.find(
    (item) =>
      !item.isMine &&
      (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') &&
      Date.parse(item.startsAt) <= now &&
      now < Date.parse(item.endsAt),
  );
  if (occupied) {
    return {
      ...base,
      endsAt: occupied.endsAt,
      hint: `Equipamento reservado por outro usuário até ${at(occupied.endsAt)}.`,
      state: 'OTHER_USER',
    };
  }

  return {
    ...base,
    hint: 'Você não possui reserva ativa para este equipamento agora.',
    state: 'NONE',
  };
}

/**
 * Builds the direct target destination URL preserving the active laboratory context.
 */
export function resolveQrDestination(parsed: ParsedQrCode, laboratoryId?: string): string {
  const query = new URLSearchParams();
  if (laboratoryId) {
    query.set('laboratory', laboratoryId);
  }

  switch (parsed.type) {
    case 'BATCH':
      query.set('batch', parsed.identifier);
      query.set('action', 'withdraw');
      return `/estoque?${query.toString()}`;

    case 'EQUIPMENT':
      query.set('equipmentId', parsed.identifier);
      return `/agenda?${query.toString()}`;

    case 'SPACE':
      query.set('space', parsed.identifier);
      return `/agenda?${query.toString()}`;

    case 'UNKNOWN':
    default:
      if (parsed.identifier) {
        query.set('search', parsed.identifier);
      }
      return `/estoque?${query.toString()}`;
  }
}

/**
 * Fetches rich entity metadata for preview and direct actions.
 */
export async function lookupAndResolveQr(
  rawCode: string,
  laboratoryId?: string,
  customFetch: typeof fetch = fetch,
): Promise<QrResolutionResult> {
  const parsed = parseQrCode(rawCode);
  const destinationUrl = resolveQrDestination(parsed, laboratoryId);

  if (!parsed.identifier) {
    return { destinationUrl, parsed };
  }

  try {
    // 1. Try Batch Lookup
    if (parsed.type === 'BATCH' || parsed.type === 'UNKNOWN') {
      // First try by-qr endpoint
      const byQrUrl = `/api/inventory/batches/by-qr/${encodeURIComponent(parsed.raw)}`;
      const byQrRes = await customFetch(byQrUrl, { cache: 'no-store' }).catch(() => null);

      if (byQrRes?.ok) {
        const batch = (await byQrRes.json()) as {
          id: string;
          laboratoryId: string;
          batchNumber: string;
          qrCode: string;
          currentBalance: number;
          initialQuantity: number;
          expirationDate?: string | null;
          manufacturer?: string | null;
        };

        const targetLab = batch.laboratoryId || laboratoryId || '';
        return {
          destinationUrl: `/estoque?laboratory=${targetLab}&batch=${batch.id}&action=withdraw`,
          entity: {
            balance: `${batch.currentBalance} / ${batch.initialQuantity}`,
            code: batch.batchNumber,
            details: [
              { label: 'Código QR', value: batch.qrCode },
              ...(batch.expirationDate
                ? [{ label: 'Validade', value: new Date(batch.expirationDate).toLocaleDateString('pt-BR') }]
                : []),
              ...(batch.manufacturer ? [{ label: 'Fabricante', value: batch.manufacturer }] : []),
            ],
            directActionHref: `/estoque?laboratory=${targetLab}&batch=${batch.id}&action=withdraw`,
            directActionLabel: 'Retirar Insumo',
            secondaryActionHref: `/estoque?laboratory=${targetLab}&batch=${batch.id}&action=ledger`,
            secondaryActionLabel: 'Ver Extrato Ledger',
            status: batch.currentBalance > 0 ? 'Disponível' : 'Esgotado',
            subtitle: `QR: ${batch.qrCode}`,
            title: `Lote ${batch.batchNumber}`,
          },
          parsed: { ...parsed, identifier: batch.id, type: 'BATCH' },
        };
      }

      // If by-qr not found, try searching batches
      const searchLabParam = laboratoryId ? `laboratoryId=${encodeURIComponent(laboratoryId)}&` : '';
      const batchSearchUrl = `/api/inventory/batches?${searchLabParam}search=${encodeURIComponent(parsed.identifier)}&limit=5`;
      const batchSearchRes = await customFetch(batchSearchUrl, { cache: 'no-store' }).catch(() => null);

      if (batchSearchRes?.ok) {
        const batchPage = (await batchSearchRes.json()) as {
          items: readonly {
            id: string;
            laboratoryId: string;
            batchNumber: string;
            qrCode: string;
            currentBalance: number;
            initialQuantity: number;
            expirationDate?: string | null;
            manufacturer?: string | null;
          }[];
        };

        const matched = batchPage.items.find(
          (b) =>
            b.id.toLowerCase() === parsed.identifier.toLowerCase() ||
            b.batchNumber.toLowerCase() === parsed.identifier.toLowerCase() ||
            b.qrCode.toLowerCase() === parsed.raw.toLowerCase(),
        );

        if (matched) {
          const targetLab = matched.laboratoryId || laboratoryId || '';
          return {
            destinationUrl: `/estoque?laboratory=${targetLab}&batch=${matched.id}&action=withdraw`,
            entity: {
              balance: `${matched.currentBalance} / ${matched.initialQuantity}`,
              code: matched.batchNumber,
              details: [
                { label: 'Código QR', value: matched.qrCode },
                ...(matched.expirationDate
                  ? [{ label: 'Validade', value: new Date(matched.expirationDate).toLocaleDateString('pt-BR') }]
                  : []),
                ...(matched.manufacturer ? [{ label: 'Fabricante', value: matched.manufacturer }] : []),
              ],
              directActionHref: `/estoque?laboratory=${targetLab}&batch=${matched.id}&action=withdraw`,
              directActionLabel: 'Retirar Insumo',
              secondaryActionHref: `/estoque?laboratory=${targetLab}&batch=${matched.id}&action=ledger`,
              secondaryActionLabel: 'Ver Extrato Ledger',
              status: matched.currentBalance > 0 ? 'Disponível' : 'Esgotado',
              subtitle: `QR: ${matched.qrCode}`,
              title: `Lote ${matched.batchNumber}`,
            },
            parsed: { ...parsed, identifier: matched.id, type: 'BATCH' },
          };
        }
      }
    }

    // 2. Try Equipment Lookup
    if (parsed.type === 'EQUIPMENT' || parsed.type === 'UNKNOWN') {
      const matched = await resolveEquipmentByQr(parsed.raw, customFetch);

      {
        if (matched) {
          // O laboratório vem do equipamento resolvido: é ele quem manda, não o
          // laboratório aberto na tela nem um palpite.
          const targetLab = matched.laboratoryId;
          // Falha na agenda degrada para o comportamento antigo (sem check-in).
          const checkIn = targetLab
            ? await resolveCheckInIntent(matched.id, targetLab, customFetch).catch(() => undefined)
            : undefined;

          return {
            destinationUrl: `/agenda?laboratory=${targetLab}&equipmentId=${matched.id}`,
            entity: {
              checkIn,
              code: matched.code,
              details: [
                ...(matched.serialNumber
                  ? [{ label: 'Nº de Série', value: matched.serialNumber }]
                  : []),
                { label: 'Status', value: matched.status },
              ],
              directActionHref: `/agenda?laboratory=${targetLab}&equipmentId=${matched.id}`,
              directActionLabel: 'Ver Agenda & Reservar',
              secondaryActionHref: `/equipamentos?laboratory=${targetLab}&search=${encodeURIComponent(matched.code)}`,
              secondaryActionLabel: 'Ficha Técnica',
              status: matched.status,
              subtitle: matched.code,
              title: matched.name,
            },
            parsed: { ...parsed, identifier: matched.id, type: 'EQUIPMENT' },
          };
        }
      }
    }
  } catch {
    // If network or parsing fails, return the standard parsed structure
  }

  return { destinationUrl, parsed };
}

/**
 * Decide se o scan deve abrir a agenda sozinho.
 *
 * Quem escaneia a etiqueta já disse o que quer. Só vale parar no cartão de
 * prévia quando há algo a fazer ali que a agenda não faz: registrar o check-in
 * de uma reserva ativa ou prestes a começar. Fora isso, o destino é a agenda do
 * equipamento, já filtrada.
 *
 * Função pura e exportada para ser testada sem montar a página.
 */
export function shouldOpenAgendaDirectly(result: QrResolutionResult): boolean {
  if (result.parsed.type !== 'EQUIPMENT') return false;
  if (!result.entity) return false;

  const state = result.entity.checkIn?.state;
  return state !== 'ELIGIBLE' && state !== 'IN_PROGRESS';
}
