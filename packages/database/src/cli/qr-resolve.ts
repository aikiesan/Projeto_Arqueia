import { isUuidIdentifier, parseQrCode } from '@arqueia/contracts';

import type { DatabasePool } from '../client.js';
import { isDirectExecution, parseArgs, runCli, withPool } from './cli-runtime.js';

/**
 * Diagnóstico de etiqueta na VM: por que este QR não abre a agenda?
 *
 * Responde as três perguntas que o suporte faz por SSH, sem abrir o navegador:
 * o código é legível? aponta para um equipamento existente? qual é a URL que a
 * etiqueta deveria abrir?
 */

export interface ResolvedQrRow {
  readonly equipmentId: string;
  readonly equipmentCode: string;
  readonly equipmentName: string;
  readonly equipmentStatus: string;
  readonly laboratoryId: string;
  readonly laboratoryCode: string;
  readonly laboratoryName: string;
  readonly archived: boolean;
}

export interface QrDiagnosis {
  readonly raw: string;
  readonly parsedType: string;
  readonly identifier: string;
  readonly identifierIsUuid: boolean;
  readonly equipment: ResolvedQrRow | null;
  readonly destinationUrl: string | null;
  readonly verdict: string;
}

interface EquipmentQrRow {
  readonly equipment_id: string;
  readonly equipment_code: string;
  readonly equipment_name: string;
  readonly equipment_status: string;
  readonly archived: boolean;
  readonly laboratory_id: string;
  readonly laboratory_code: string;
  readonly laboratory_name: string;
}

/**
 * Procura arquivados de propósito: uma etiqueta colada num equipamento
 * arquivado é exatamente o caso que o suporte precisa distinguir de "código
 * inexistente" — os dois falham igual na tela.
 */
export async function findEquipmentForQr(
  pool: DatabasePool,
  identifier: string,
): Promise<ResolvedQrRow | null> {
  const sql = `
    SELECT e.id AS equipment_id, e.code AS equipment_code, e.name AS equipment_name,
           e.status AS equipment_status, (e.archived_at IS NOT NULL) AS archived,
           l.id AS laboratory_id, l.code AS laboratory_code, l.name AS laboratory_name
      FROM equipment e
      JOIN laboratories l ON l.id = e.laboratory_id
     WHERE ${isUuidIdentifier(identifier) ? 'e.id = $1::uuid OR ' : ''}upper(e.code) = upper($2)
     LIMIT 1`;

  const result = await pool.query<EquipmentQrRow>(sql, [
    isUuidIdentifier(identifier) ? identifier : null,
    identifier,
  ]);
  const row = result.rows[0];
  if (row === undefined) return null;

  return {
    archived: row.archived,
    equipmentCode: row.equipment_code,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentStatus: row.equipment_status,
    laboratoryCode: row.laboratory_code,
    laboratoryId: row.laboratory_id,
    laboratoryName: row.laboratory_name,
  };
}

/** Núcleo puro: dado o que o banco devolveu, qual é o veredito? */
export function diagnose(
  raw: string,
  equipment: ResolvedQrRow | null,
  publicOrigin: string,
  basePath: string,
): QrDiagnosis {
  const parsed = parseQrCode(raw);
  const base = {
    identifier: parsed.identifier,
    identifierIsUuid: isUuidIdentifier(parsed.identifier),
    parsedType: parsed.type,
    raw,
  };

  if (parsed.type === 'BATCH' || parsed.type === 'SPACE') {
    return {
      ...base,
      destinationUrl: null,
      equipment: null,
      verdict: `Etiqueta de ${parsed.type === 'BATCH' ? 'lote' : 'espaço'}, não de equipamento.`,
    };
  }

  if (equipment === null) {
    return {
      ...base,
      destinationUrl: null,
      equipment: null,
      verdict: `Nenhum equipamento com id ou código "${parsed.identifier}".`,
    };
  }

  if (equipment.archived) {
    return {
      ...base,
      destinationUrl: null,
      equipment,
      verdict: 'Equipamento ARQUIVADO: a etiqueta não resolve até ele ser reativado.',
    };
  }

  const prefix = basePath === '/' ? '' : basePath;
  return {
    ...base,
    destinationUrl: `${publicOrigin.replace(/\/$/, '')}${prefix}/agenda?laboratory=${equipment.laboratoryId}&equipmentId=${equipment.equipmentId}`,
    equipment,
    verdict: 'OK — a etiqueta resolve.',
  };
}

export function formatDiagnosis(diagnosis: QrDiagnosis): string {
  const lines = [
    `código lido .... ${diagnosis.raw}`,
    `classificação .. ${diagnosis.parsedType}`,
    `identificador .. ${diagnosis.identifier}${diagnosis.identifierIsUuid ? ' (uuid)' : ' (código)'}`,
  ];

  if (diagnosis.equipment) {
    const equipment = diagnosis.equipment;
    lines.push(
      `equipamento .... ${equipment.equipmentName} [${equipment.equipmentCode}] ${equipment.equipmentStatus}`,
      `laboratório .... ${equipment.laboratoryName} [${equipment.laboratoryCode}] ${equipment.laboratoryId}`,
    );
  }
  if (diagnosis.destinationUrl) lines.push(`destino ........ ${diagnosis.destinationUrl}`);
  lines.push(`veredito ....... ${diagnosis.verdict}`);

  return lines.join('\n');
}

export async function runQrResolve(
  argv: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<QrDiagnosis> {
  const { positional, options } = parseArgs(argv);
  const raw = positional[0]?.trim();
  if (!raw) throw new Error('uso: npm run qr:resolve -- <código ou URL da etiqueta>');

  const parsed = parseQrCode(raw);
  const equipment =
    parsed.type === 'EQUIPMENT' || parsed.type === 'UNKNOWN'
      ? await withPool((pool) => findEquipmentForQr(pool, parsed.identifier), environment)
      : null;

  return diagnose(
    raw,
    equipment,
    options.origin ?? environment.PUBLIC_ORIGIN ?? 'https://cp2b.unicamp.br',
    options.basePath ?? environment.NEXT_PUBLIC_BASE_PATH ?? '/arqueia',
  );
}

if (isDirectExecution(import.meta.url)) {
  runCli('database:qr-resolve', async () => {
    const diagnosis = await runQrResolve();
    console.info(formatDiagnosis(diagnosis));
    if (diagnosis.destinationUrl === null) process.exitCode = 1;
  });
}
