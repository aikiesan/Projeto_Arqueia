/**
 * Conteúdo do QR de informes: a URL absoluta do formulário público.
 *
 * URL (e não um código cru) para que a câmera nativa do celular abra direto o
 * formulário. Aponta para `/informar`, que é servido sem login — diferente da
 * etiqueta do equipamento (`/qr`), que exige sessão. Com `equipmentId`, o
 * formulário já abre com o equipamento escolhido.
 */
export function buildFieldReportQrPayload(
  origin: string,
  basePath: string,
  laboratoryId: string,
  equipmentId?: string,
): string {
  const prefix = basePath === '/' ? '' : basePath;
  const query = new URLSearchParams({ laboratory: laboratoryId });
  if (equipmentId !== undefined) query.set('equipment', equipmentId);
  return `${origin.replace(/\/$/, '')}${prefix}/informar?${query.toString()}`;
}
