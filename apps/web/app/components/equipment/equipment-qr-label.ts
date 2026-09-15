import { EQUIPMENT_QR_PREFIX } from '@arqueia/contracts';

/**
 * Conteúdo gravado no QR físico do equipamento.
 *
 * É uma URL absoluta, e não apenas o código `ARQ-EQP-<id>`, para que a câmera
 * nativa do celular (que só sabe abrir links) leve direto ao app. O leitor
 * interno continua funcionando porque `parseQrCode` reconhece tanto a URL
 * `/qr?code=…` quanto o código cru.
 */
export function buildEquipmentQrPayload(
  equipmentId: string,
  origin: string,
  basePath: string,
): string {
  const code = `${EQUIPMENT_QR_PREFIX}${equipmentId}`;
  const prefix = basePath === '/' ? '' : basePath;
  return `${origin.replace(/\/$/, '')}${prefix}/qr?code=${encodeURIComponent(code)}`;
}
