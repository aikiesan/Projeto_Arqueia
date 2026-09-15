import {
  CHECK_IN_EARLY_TOLERANCE_MINUTES,
  CHECK_IN_LOOKUP_WINDOW_HOURS,
  scheduleResponseSchema,
} from '@arqueia/contracts';

export type QrEntityType = 'BATCH' | 'EQUIPMENT' | 'SPACE' | 'UNKNOWN';

export interface ParsedQrCode {
  readonly raw: string;
  readonly type: QrEntityType;
  readonly identifier: string;
  readonly originalUrl?: string;
  readonly actionHint?: 'withdraw' | 'reserve' | 'view';
}

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


const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EquipmentListItem {
  readonly id: string;
  readonly laboratoryId: string;
  readonly code: string;
  readonly name: string;
  readonly model?: string | null;
  readonly serialNumber?: string | null;
  readonly status: string;
}

/**
 * Acha um equipamento pelo UUID gravado na etiqueta.
 *
 * A API de equipamentos não expõe busca por id (`search` casa nome/código), e
 * não há endpoint GET por id — então paginamos e casamos no cliente. O limite de
 * páginas evita varrer um laboratório inteiro por um código inválido.
 */
async function findEquipmentById(
  equipmentId: string,
  laboratoryId: string | undefined,
  customFetch: typeof fetch,
): Promise<EquipmentListItem | null> {
  if (!laboratoryId) return null;

  let cursor: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ laboratoryId, limit: '50' });
    if (cursor) query.set('cursor', cursor);

    const response = await customFetch(`/api/equipment?${query.toString()}`, {
      cache: 'no-store',
    }).catch(() => null);
    if (!response?.ok) return null;

    const body = (await response.json()) as {
      items: readonly EquipmentListItem[];
      pageInfo?: { hasNextPage: boolean; nextCursor: string | null };
    };

    const matched = body.items.find((item) => item.id.toLowerCase() === equipmentId.toLowerCase());
    if (matched) return matched;

    if (!body.pageInfo?.hasNextPage || !body.pageInfo.nextCursor) return null;
    cursor = body.pageInfo.nextCursor;
  }

  return null;
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
 * Parses raw text, barcode or QR string into a typed operational entity structure.
 */
export function parseQrCode(input: string): ParsedQrCode {
  const raw = input.trim();
  if (!raw) {
    return { actionHint: 'view', identifier: '', raw: '', type: 'UNKNOWN' };
  }

  // Check if input is a complete URL
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      // /estoque?batch=... or ?batchId=...
      if (url.pathname.includes('/estoque')) {
        const batchParam = url.searchParams.get('batch') ?? url.searchParams.get('batchId');
        if (batchParam) {
          return {
            actionHint: 'withdraw',
            identifier: batchParam,
            originalUrl: raw,
            raw,
            type: 'BATCH',
          };
        }
      }
      // /agenda?equipment=... or ?equipmentId=...
      if (url.pathname.includes('/agenda')) {
        const eqpParam = url.searchParams.get('equipmentId') ?? url.searchParams.get('equipment');
        if (eqpParam) {
          return {
            actionHint: 'reserve',
            identifier: eqpParam,
            originalUrl: raw,
            raw,
            type: 'EQUIPMENT',
          };
        }
      }
      // /qr?code=...
      if (url.pathname.includes('/qr')) {
        const codeParam = url.searchParams.get('code');
        if (codeParam) {
          const inner = parseQrCode(codeParam);
          return { ...inner, originalUrl: raw, raw };
        }
      }
    } catch {
      // ignore URL parse errors
    }
  }

  // Batch QR prefixes: ARQ-LOT-..., ARQ-CP2B-PRD-..., LOT-..., QR-...
  const arqLotMatch = /^ARQ-LOT-(.+)$/i.exec(raw);
  if (arqLotMatch?.[1]) {
    return {
      actionHint: 'withdraw',
      identifier: arqLotMatch[1],
      raw,
      type: 'BATCH',
    };
  }

  if (/^ARQ-CP2B-PRD-/i.test(raw) || /^LOT-/i.test(raw) || /^QR-LOT-/i.test(raw)) {
    return {
      actionHint: 'withdraw',
      identifier: raw,
      raw,
      type: 'BATCH',
    };
  }

  // Equipment QR prefixes: ARQ-EQP-..., CP2B-EQP-..., EQP-..., QR-EQP-...
  const arqEqpMatch = /^ARQ-EQP-(.+)$/i.exec(raw);
  if (arqEqpMatch?.[1]) {
    return {
      actionHint: 'reserve',
      identifier: arqEqpMatch[1],
      raw,
      type: 'EQUIPMENT',
    };
  }

  if (/^CP2B-EQP-/i.test(raw) || /^EQP-/i.test(raw) || /^QR-EQP-/i.test(raw)) {
    return {
      actionHint: 'reserve',
      identifier: raw,
      raw,
      type: 'EQUIPMENT',
    };
  }

  // Space QR prefixes: ARQ-SPC-..., ARQ-LOC-..., SPC-...
  const arqSpcMatch = /^(?:ARQ-SPC-|ARQ-LOC-|SPC-)(.+)$/i.exec(raw);
  if (arqSpcMatch?.[1]) {
    return {
      actionHint: 'view',
      identifier: arqSpcMatch[1],
      raw,
      type: 'SPACE',
    };
  }

  return {
    actionHint: 'view',
    identifier: raw,
    raw,
    type: 'UNKNOWN',
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
      // A etiqueta grava o UUID, que o filtro `search` (nome/código) não acha:
      // nesse caso paginamos e casamos por id.
      let matched: EquipmentListItem | null = UUID_PATTERN.test(parsed.identifier)
        ? await findEquipmentById(parsed.identifier, laboratoryId, customFetch)
        : null;

      if (!matched) {
        const searchLabParam = laboratoryId ? `laboratoryId=${encodeURIComponent(laboratoryId)}&` : '';
        const eqpSearchUrl = `/api/equipment?${searchLabParam}search=${encodeURIComponent(parsed.identifier)}&limit=5`;
        const eqpRes = await customFetch(eqpSearchUrl, { cache: 'no-store' }).catch(() => null);

        if (eqpRes?.ok) {
          const eqpPage = (await eqpRes.json()) as { items: readonly EquipmentListItem[] };
          matched =
            eqpPage.items.find(
              (e) =>
                e.id.toLowerCase() === parsed.identifier.toLowerCase() ||
                e.code.toLowerCase() === parsed.identifier.toLowerCase() ||
                e.code.toLowerCase() === parsed.raw.toLowerCase() ||
                e.name.toLowerCase().includes(parsed.identifier.toLowerCase()),
            ) ?? null;
        }
      }

      {
        if (matched) {
          const targetLab = matched.laboratoryId || laboratoryId || '';
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
                ...(matched.model ? [{ label: 'Modelo', value: matched.model }] : []),
                ...(matched.serialNumber ? [{ label: 'Nº de Série', value: matched.serialNumber }] : []),
                { label: 'Status', value: matched.status },
              ],
              directActionHref: `/agenda?laboratory=${targetLab}&equipmentId=${matched.id}`,
              directActionLabel: 'Ver Agenda & Reservar',
              secondaryActionHref: `/equipamentos?laboratory=${targetLab}&search=${encodeURIComponent(matched.code)}`,
              secondaryActionLabel: 'Ficha Técnica',
              status: matched.status,
              subtitle: matched.model ?? 'Equipamento',
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
