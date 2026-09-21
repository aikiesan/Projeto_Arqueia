import { z } from 'zod';

/**
 * Leitura de etiquetas de QR — definição única, compartilhada.
 *
 * Mora em `contracts` porque três consumidores precisam concordar sobre o que
 * uma etiqueta significa: o leitor no navegador, o endpoint que resolve o
 * equipamento no servidor e a CLI de diagnóstico da VM. Enquanto isso vivia só
 * em `apps/web`, a API não tinha como validar o que o cliente havia lido.
 *
 * É uma função pura: não faz I/O e não decide autorização. Traduzir o código em
 * uma entidade — e dizer se o solicitante pode vê-la — é papel do caso de uso.
 */

/*
 * `EQUIPMENT_QR_PREFIX` continua em `scheduling/reservation.ts`, onde já era a
 * fonte usada pelo construtor da etiqueta — redefinir aqui criaria duas
 * verdades para o mesmo prefixo.
 */

/** Limite defensivo: etiqueta é URL curta, não payload arbitrário. */
export const QR_CODE_MAX_LENGTH = 512;

export const qrEntityTypes = ['BATCH', 'EQUIPMENT', 'SPACE', 'UNKNOWN'] as const;
export const qrEntityTypeSchema = z.enum(qrEntityTypes);
export type QrEntityType = z.infer<typeof qrEntityTypeSchema>;

export type QrActionHint = 'withdraw' | 'reserve' | 'view';

export interface ParsedQrCode {
  readonly raw: string;
  readonly type: QrEntityType;
  /** Id ou código da entidade, já sem o prefixo da etiqueta. */
  readonly identifier: string;
  readonly originalUrl?: string;
  readonly actionHint?: QrActionHint;
}

export const resolveEquipmentByQrQuerySchema = z
  .object({ code: z.string().trim().min(1).max(QR_CODE_MAX_LENGTH) })
  .strict();

export type ResolveEquipmentByQrQuery = z.output<typeof resolveEquipmentByQrQuerySchema>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O identificador é um UUID de entidade, e não um código legível como `CP2b-HPLC-01`. */
export function isUuidIdentifier(identifier: string): boolean {
  return UUID_PATTERN.test(identifier);
}

function equipment(identifier: string, raw: string, originalUrl?: string): ParsedQrCode {
  return originalUrl === undefined
    ? { actionHint: 'reserve', identifier, raw, type: 'EQUIPMENT' }
    : { actionHint: 'reserve', identifier, originalUrl, raw, type: 'EQUIPMENT' };
}

function batch(identifier: string, raw: string, originalUrl?: string): ParsedQrCode {
  return originalUrl === undefined
    ? { actionHint: 'withdraw', identifier, raw, type: 'BATCH' }
    : { actionHint: 'withdraw', identifier, originalUrl, raw, type: 'BATCH' };
}

/**
 * Etiquetas gravam uma URL absoluta (para a câmera nativa abrir o app), mas o
 * leitor interno também aceita o código cru. As duas formas caem aqui.
 */
function parseUrl(raw: string): ParsedQrCode | null {
  if (!/^https?:\/\//i.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.pathname.includes('/estoque')) {
    const batchParam = url.searchParams.get('batch') ?? url.searchParams.get('batchId');
    if (batchParam) return batch(batchParam, raw, raw);
  }

  if (url.pathname.includes('/agenda')) {
    const equipmentParam =
      url.searchParams.get('equipmentId') ?? url.searchParams.get('equipment');
    if (equipmentParam) return equipment(equipmentParam, raw, raw);
  }

  if (url.pathname.includes('/qr')) {
    const codeParam = url.searchParams.get('code');
    // A etiqueta impressa é `/qr?code=ARQ-EQP-<uuid>`: o conteúdo real está aqui.
    if (codeParam) return { ...parseQrCode(codeParam), originalUrl: raw, raw };
  }

  return null;
}

export function parseQrCode(input: string): ParsedQrCode {
  const raw = input.trim();
  if (!raw) return { actionHint: 'view', identifier: '', raw: '', type: 'UNKNOWN' };

  const fromUrl = parseUrl(raw);
  if (fromUrl) return fromUrl;

  const arqLot = /^ARQ-LOT-(.+)$/i.exec(raw);
  if (arqLot?.[1]) return batch(arqLot[1], raw);
  if (/^ARQ-CP2B-PRD-/i.test(raw) || /^LOT-/i.test(raw) || /^QR-LOT-/i.test(raw)) {
    return batch(raw, raw);
  }

  const arqEqp = /^ARQ-EQP-(.+)$/i.exec(raw);
  if (arqEqp?.[1]) return equipment(arqEqp[1], raw);
  if (/^CP2B-EQP-/i.test(raw) || /^EQP-/i.test(raw) || /^QR-EQP-/i.test(raw)) {
    return equipment(raw, raw);
  }

  const arqSpc = /^(?:ARQ-SPC-|ARQ-LOC-|SPC-)(.+)$/i.exec(raw);
  if (arqSpc?.[1]) return { actionHint: 'view', identifier: arqSpc[1], raw, type: 'SPACE' };

  return { actionHint: 'view', identifier: raw, raw, type: 'UNKNOWN' };
}
