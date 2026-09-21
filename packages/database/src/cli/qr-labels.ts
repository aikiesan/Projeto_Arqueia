import { EQUIPMENT_QR_PREFIX } from '@arqueia/contracts';

import type { DatabasePool } from '../client.js';
import { isDirectExecution, parseArgs, runCli, withPool } from './cli-runtime.js';

/**
 * Geração de etiquetas em lote.
 *
 * O payload é idêntico ao de `buildEquipmentQrPayload` no web: uma URL absoluta
 * para `/qr?code=ARQ-EQP-<id>`, para a câmera nativa do celular abrir o app
 * direto. Mantê-los em sincronia é responsabilidade desta anotação — o web
 * monta no navegador, a CLI monta a partir do banco.
 */

export interface EquipmentLabel {
  readonly equipmentId: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly laboratoryCode: string;
  readonly payload: string;
}

interface LabelRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly laboratory_code: string;
}

export function buildQrPayload(equipmentId: string, origin: string, basePath: string): string {
  const prefix = basePath === '/' ? '' : basePath;
  const code = `${EQUIPMENT_QR_PREFIX}${equipmentId}`;
  return `${origin.replace(/\/$/, '')}${prefix}/qr?code=${encodeURIComponent(code)}`;
}

export async function listEquipmentForLabels(
  pool: DatabasePool,
  laboratory: string | undefined,
): Promise<readonly LabelRow[]> {
  const result = await pool.query<LabelRow>(
    `SELECT e.id, e.code, e.name, e.status, l.code AS laboratory_code
       FROM equipment e
       JOIN laboratories l ON l.id = e.laboratory_id
      WHERE e.archived_at IS NULL
        AND ($1::text IS NULL OR l.id::text = $1 OR upper(l.code) = upper($1))
      ORDER BY l.code ASC, e.code ASC`,
    [laboratory ?? null],
  );
  return result.rows;
}

export function toLabels(
  rows: readonly LabelRow[],
  origin: string,
  basePath: string,
): readonly EquipmentLabel[] {
  return rows.map((row) => ({
    code: row.code,
    equipmentId: row.id,
    laboratoryCode: row.laboratory_code,
    name: row.name,
    payload: buildQrPayload(row.id, origin, basePath),
    status: row.status,
  }));
}

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export function renderCsv(labels: readonly EquipmentLabel[]): string {
  const header = ['laboratorio', 'codigo', 'nome', 'status', 'equipamento_id', 'qr_payload'];
  const rows = labels.map((label) =>
    [
      label.laboratoryCode,
      label.code,
      label.name,
      label.status,
      label.equipmentId,
      label.payload,
    ]
      .map(escapeCsv)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) =>
    character === '&'
      ? '&amp;'
      : character === '<'
        ? '&lt;'
        : character === '>'
          ? '&gt;'
          : character === '"'
            ? '&quot;'
            : '&#39;',
  );

/**
 * Folha pronta para impressão. O QR é desenhado pelo navegador a partir do
 * payload, via uma biblioteca carregada na própria página — assim a CLI não
 * precisa de dependência de imagem e o arquivo continua sendo texto.
 */
export function renderPrintableHtml(labels: readonly EquipmentLabel[]): string {
  const cards = labels
    .map(
      (label) => `    <figure class="etiqueta">
      <div class="qr" data-payload="${escapeHtml(label.payload)}"></div>
      <figcaption>
        <strong>${escapeHtml(label.name)}</strong>
        <code>${escapeHtml(label.code)}</code>
        <small>${escapeHtml(label.laboratoryCode)}</small>
      </figcaption>
    </figure>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Etiquetas QR — Arqueia</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 12mm; }
  .folha { display: grid; gap: 8mm; grid-template-columns: repeat(auto-fill, minmax(45mm, 1fr)); }
  .etiqueta { border: 1px solid #ccc; border-radius: 3mm; margin: 0; padding: 4mm; text-align: center; page-break-inside: avoid; }
  .qr { display: flex; justify-content: center; min-height: 32mm; }
  .qr canvas, .qr img { height: 32mm; width: 32mm; }
  figcaption { display: grid; gap: 1mm; margin-top: 2mm; }
  figcaption strong { font-size: 9pt; line-height: 1.2; }
  figcaption code { font-size: 8pt; color: #444; }
  figcaption small { font-size: 7pt; color: #777; }
  @media print { body { margin: 8mm; } }
</style>
</head>
<body>
<h1>Etiquetas QR — ${labels.length} equipamento(s)</h1>
<div class="folha">
${cards}
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
<script>
  for (const node of document.querySelectorAll('.qr')) {
    QRCode.toCanvas(node.dataset.payload, { margin: 1, width: 256 })
      .then((canvas) => node.append(canvas));
  }
</script>
</body>
</html>`;
}

export async function runQrLabels(
  argv: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const { options } = parseArgs(argv);
  const format = options.format ?? 'csv';
  if (format !== 'csv' && format !== 'html') {
    throw new Error('--format aceita apenas csv ou html.');
  }

  const rows = await withPool((pool) => listEquipmentForLabels(pool, options.laboratory), environment);
  const labels = toLabels(
    rows,
    options.origin ?? environment.PUBLIC_ORIGIN ?? 'https://cp2b.unicamp.br',
    options.basePath ?? environment.NEXT_PUBLIC_BASE_PATH ?? '/arqueia',
  );

  return format === 'csv' ? renderCsv(labels) : renderPrintableHtml(labels);
}

if (isDirectExecution(import.meta.url)) {
  runCli('database:qr-labels', async () => {
    // Saída em stdout puro: o operador redireciona para arquivo.
    process.stdout.write(`${await runQrLabels()}\n`);
  });
}
