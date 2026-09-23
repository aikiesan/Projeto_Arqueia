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
 * Procura como a API procura — UUID pelo id, código legível pelo `code` — mas
 * inclui arquivados e devolve **todos** os candidatos, não só o primeiro. É o
 * que permite explicar por que a etiqueta falha: arquivado, ambíguo e
 * inexistente parecem iguais na tela.
 *
 * Cada ramo referencia exatamente os parâmetros que recebe. A primeira versão
 * mandava `[null, código]` para um SQL que só usava `$2`: o Postgres não
 * consegue inferir o tipo de um `$1` que ninguém lê, e toda consulta por código
 * abortava com "could not determine data type of parameter $1".
 */
export async function findEquipmentForQr(
  pool: DatabasePool,
  identifier: string,
): Promise<readonly ResolvedQrRow[]> {
  const match = isUuidIdentifier(identifier) ? 'e.id = $1::uuid' : 'upper(e.code) = upper($1)';
  const result = await pool.query<EquipmentQrRow>(
    `SELECT e.id AS equipment_id, e.code AS equipment_code, e.name AS equipment_name,
            e.status AS equipment_status, (e.archived_at IS NOT NULL) AS archived,
            l.id AS laboratory_id, l.code AS laboratory_code, l.name AS laboratory_name
       FROM equipment e
       JOIN laboratories l ON l.id = e.laboratory_id
      WHERE ${match}
      ORDER BY e.archived_at IS NULL DESC, l.code ASC
      LIMIT 20`,
    [identifier],
  );

  return result.rows.map((row) => ({
    archived: row.archived,
    equipmentCode: row.equipment_code,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentStatus: row.equipment_status,
    laboratoryCode: row.laboratory_code,
    laboratoryId: row.laboratory_id,
    laboratoryName: row.laboratory_name,
  }));
}

/** Núcleo puro: dado o que o banco devolveu, qual é o veredito? */
export function diagnose(
  raw: string,
  candidates: readonly ResolvedQrRow[],
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

  // Mesma regra de `findActiveByQrIdentifier` na API: resolve só com
  // exatamente um equipamento ativo. Aqui ela só ganha a explicação do porquê.
  const active = candidates.filter((candidate) => !candidate.archived);

  if (active.length > 1) {
    const laboratories = active.map((candidate) => candidate.laboratoryCode).join(', ');
    return {
      ...base,
      destinationUrl: null,
      equipment: null,
      verdict: `Código AMBÍGUO: "${parsed.identifier}" existe em ${active.length} laboratórios (${laboratories}). O servidor recusa resolvê-lo — use a etiqueta com UUID.`,
    };
  }

  const equipment = active[0];
  if (equipment === undefined) {
    const archived = candidates[0];
    return archived === undefined
      ? {
          ...base,
          destinationUrl: null,
          equipment: null,
          verdict: `Nenhum equipamento com id ou código "${parsed.identifier}".`,
        }
      : {
          ...base,
          destinationUrl: null,
          equipment: archived,
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
  const candidates =
    parsed.type === 'EQUIPMENT' || parsed.type === 'UNKNOWN'
      ? await withPool((pool) => findEquipmentForQr(pool, parsed.identifier), environment)
      : [];

  return diagnose(
    raw,
    candidates,
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
