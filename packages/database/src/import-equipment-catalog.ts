/**
 * Importa o catálogo de equipamentos do CP2b para um laboratório já existente.
 *
 * Diferente de `seed.ts`, este script é seguro para produção: não cria
 * instituição, laboratório, projeto de demonstração nem administrador, e
 * recusa a operação se o laboratório ou o responsável não existirem.
 *
 * A importação traz apenas identificação e enquadramento de catálogo. Nº de
 * patrimônio, número de série, responsável, espaço e bancada ficam vazios de
 * propósito — são os detalhes que a equipe do laboratório preenche na
 * ferramenta. Por isso equipamentos já existentes nunca são sobrescritos.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDatabasePool,
  inTransaction,
  type DatabaseClient,
  type DatabaseConfig,
  type DatabasePool,
} from './client.js';
import { CP2B_EQUIPMENT_CATALOG } from './reference-data/cp2b-equipment-catalog.js';
import { seedCP2bReferenceCatalog } from './reference-data/seed-cp2b-catalog.js';
import { seedFapespReferenceCatalog } from './reference-data/seed-fapesp-catalog.js';

export interface ImportEquipmentEnvironment {
  readonly DATABASE_URL?: string;
  readonly IMPORT_LABORATORY_ID?: string;
  readonly IMPORT_ACTOR_EMAIL?: string;
  readonly IMPORT_DRY_RUN?: string;
}

export interface ImportEquipmentConfig {
  readonly databaseUrl: string;
  readonly laboratoryId: string;
  readonly actorEmail: string;
  readonly dryRun: boolean;
}

export interface ImportEquipmentResult {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
  readonly unmatched: readonly string[];
  readonly dryRun: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateImportEquipmentEnvironment(
  environment: ImportEquipmentEnvironment,
): ImportEquipmentConfig {
  const databaseUrl = environment.DATABASE_URL?.trim() ?? '';
  if (databaseUrl.length === 0) throw new Error('DATABASE_URL é obrigatória.');

  const laboratoryId = environment.IMPORT_LABORATORY_ID?.trim() ?? '';
  if (!UUID_PATTERN.test(laboratoryId)) {
    throw new Error('IMPORT_LABORATORY_ID deve ser o UUID de um laboratório existente.');
  }

  const actorEmail = environment.IMPORT_ACTOR_EMAIL?.trim().toLowerCase() ?? '';
  if (actorEmail.length === 0) {
    throw new Error('IMPORT_ACTOR_EMAIL é obrigatória: a importação é registrada em auditoria.');
  }

  return {
    databaseUrl,
    laboratoryId,
    actorEmail,
    dryRun: environment.IMPORT_DRY_RUN?.trim().toLowerCase() === 'true',
  };
}

async function requireLaboratory(client: DatabaseClient, laboratoryId: string): Promise<void> {
  const result = await client.query<{ readonly id: string }>(
    'SELECT id FROM laboratories WHERE id = $1 AND archived_at IS NULL',
    [laboratoryId],
  );
  if (result.rows[0] === undefined) {
    throw new Error(`Laboratório ${laboratoryId} não existe ou está arquivado.`);
  }
}

async function requireActor(client: DatabaseClient, actorEmail: string): Promise<string> {
  const result = await client.query<{ readonly id: string }>(
    `SELECT id FROM users
      WHERE lower(email) = $1 AND status = 'ACTIVE' AND archived_at IS NULL`,
    [actorEmail],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error(`Nenhum usuário ativo com e-mail ${actorEmail}.`);
  }
  return row.id;
}

export async function importEquipmentCatalog(
  pool: DatabasePool,
  config: ImportEquipmentConfig,
): Promise<ImportEquipmentResult> {
  return inTransaction(pool, async (client) => {
    await requireLaboratory(client, config.laboratoryId);
    const actorId = await requireActor(client, config.actorEmail);

    // As opções de catálogo são pré-requisito: `equipment.catalog_option_id` é
    // NOT NULL e precisa apontar para uma opção do mesmo laboratório. Ambos os
    // seeds de catálogo são idempotentes.
    await seedCP2bReferenceCatalog(client, config.laboratoryId, actorId);
    await seedFapespReferenceCatalog(client, config.laboratoryId, actorId);

    const created: string[] = [];
    const skipped: string[] = [];
    const unmatched: string[] = [];

    for (const equipment of CP2B_EQUIPMENT_CATALOG) {
      const optionResult = await client.query<{ readonly id: string }>(
        `SELECT id FROM catalog_options
          WHERE laboratory_id = $1 AND archived_at IS NULL
            AND (label ILIKE $2 OR code ILIKE $2)
          ORDER BY created_at ASC
          LIMIT 1`,
        [config.laboratoryId, `%${equipment.searchKey}%`],
      );
      const optionId = optionResult.rows[0]?.id;
      if (optionId === undefined) {
        unmatched.push(equipment.code);
        continue;
      }

      const inserted = await client.query<{ readonly id: string }>(
        `INSERT INTO equipment (
           laboratory_id, catalog_option_id, code, name, status,
           max_reservation_minutes, requires_training, requires_approval,
           absence_release_minutes, notes
         )
         VALUES ($1, $2, $3, $4, 'AVAILABLE', $5, $6, false, 30, $7)
         ON CONFLICT (laboratory_id, code) WHERE archived_at IS NULL
         DO NOTHING
         RETURNING id`,
        [
          config.laboratoryId,
          optionId,
          equipment.code,
          equipment.name,
          equipment.maxMinutes,
          equipment.requiresTraining,
          equipment.notes,
        ],
      );

      const equipmentId = inserted.rows[0]?.id;
      if (equipmentId === undefined) {
        skipped.push(equipment.code);
        continue;
      }

      created.push(equipment.code);
      await client.query(
        `INSERT INTO audit_events (
           actor_id, laboratory_id, action, entity, entity_id, before, after, origin
         ) VALUES ($1, $2, 'equipment.imported', 'Equipment', $3, NULL, $4::jsonb, 'import-equipment-catalog')`,
        [
          actorId,
          config.laboratoryId,
          equipmentId,
          JSON.stringify({ code: equipment.code, name: equipment.name }),
        ],
      );
    }

    if (config.dryRun) {
      // Desfaz tudo: a simulação serve para conferir o que entraria.
      throw new DryRunSignal({ created, skipped, unmatched, dryRun: true });
    }

    return { created, skipped, unmatched, dryRun: false };
  });
}

class DryRunSignal extends Error {
  public constructor(public readonly result: ImportEquipmentResult) {
    super('dry-run');
  }
}

export async function runImportEquipmentCatalog(
  environment: ImportEquipmentEnvironment = process.env,
  createPool: (config: DatabaseConfig) => DatabasePool = createDatabasePool,
): Promise<ImportEquipmentResult> {
  const config = validateImportEquipmentEnvironment(environment);
  const pool = createPool({ connectionString: config.databaseUrl, maxConnections: 1 });
  try {
    return await importEquipmentCatalog(pool, config);
  } catch (error: unknown) {
    if (error instanceof DryRunSignal) return error.result;
    throw error;
  } finally {
    await pool.end();
  }
}

const invokedPath = process.argv[1];
const isDirectExecution =
  invokedPath !== undefined && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runImportEquipmentCatalog()
    .then((result) => {
      const prefix = result.dryRun
        ? '[database:import-equipment] SIMULAÇÃO (nada gravado)'
        : '[database:import-equipment]';
      console.info(`${prefix} criados: ${result.created.length}`);
      console.info(`${prefix} já existentes, preservados: ${result.skipped.length}`);
      if (result.unmatched.length > 0) {
        console.warn(
          `${prefix} sem opção de catálogo correspondente: ${result.unmatched.join(', ')}`,
        );
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'falha desconhecida';
      console.error(`[database:import-equipment] falhou: ${message}`);
      process.exitCode = 1;
    });
}
