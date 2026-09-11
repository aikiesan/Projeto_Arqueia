import { describe, expect, it, vi } from 'vitest';

import type { DatabasePool } from './client.js';
import {
  runImportEquipmentCatalog,
  validateImportEquipmentEnvironment,
} from './import-equipment-catalog.js';
import { CP2B_EQUIPMENT_CATALOG } from './reference-data/cp2b-equipment-catalog.js';

const laboratoryId = '4c536fc4-c406-4cd4-bfc9-42a07547519e';
const actorId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const optionId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://arqueia@127.0.0.1:5432/arqueia',
  IMPORT_LABORATORY_ID: laboratoryId,
  IMPORT_ACTOR_EMAIL: 'Lucasnc@unicamp.br',
};

/**
 * Pool falso: responde ao mínimo que o importador consulta e registra o SQL
 * emitido. `equipmentInsertRows` decide se cada INSERT de equipamento "pegou"
 * (linha devolvida) ou colidiu com um registro existente (nenhuma linha).
 */
function fakePool(overrides: {
  laboratoryRows?: unknown[];
  actorRows?: unknown[];
  optionRows?: unknown[];
  equipmentInsertRows?: unknown[];
}) {
  const calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const query = vi.fn(async (sql: string, parameters: readonly unknown[] = []) => {
    calls.push({ sql, parameters });
    if (sql.includes('FROM laboratories')) {
      return { rows: overrides.laboratoryRows ?? [{ id: laboratoryId }] };
    }
    if (sql.includes('FROM users')) {
      return { rows: overrides.actorRows ?? [{ id: actorId }] };
    }
    if (sql.includes('FROM catalog_options') && sql.includes('SELECT id')) {
      return { rows: overrides.optionRows ?? [{ id: optionId }] };
    }
    if (sql.includes('INSERT INTO equipment')) {
      return { rows: overrides.equipmentInsertRows ?? [{ id: 'equipment-1' }] };
    }
    // Os seeds de catálogo (pré-requisito idempotente) fazem vários
    // INSERT ... RETURNING; basta devolver algum id para que sigam adiante.
    return { rows: [{ id: 'catalog-row' }] };
  });
  const release = vi.fn();
  const end = vi.fn();
  const pool = {
    query,
    connect: vi.fn(async () => ({ query, release })),
    end,
  } as unknown as DatabasePool;
  return { pool, calls, end };
}

describe('validateImportEquipmentEnvironment', () => {
  it('exige um UUID de laboratório', () => {
    expect(() =>
      validateImportEquipmentEnvironment({ ...baseEnvironment, IMPORT_LABORATORY_ID: 'CP2b' }),
    ).toThrow(/IMPORT_LABORATORY_ID/);
  });

  it('exige o responsável pela importação e normaliza o e-mail', () => {
    expect(() =>
      validateImportEquipmentEnvironment({ ...baseEnvironment, IMPORT_ACTOR_EMAIL: '  ' }),
    ).toThrow(/IMPORT_ACTOR_EMAIL/);
    expect(validateImportEquipmentEnvironment(baseEnvironment).actorEmail).toBe(
      'lucasnc@unicamp.br',
    );
  });
});

describe('runImportEquipmentCatalog', () => {
  it('recusa laboratório inexistente antes de gravar qualquer coisa', async () => {
    const { pool, calls } = fakePool({ laboratoryRows: [] });

    await expect(runImportEquipmentCatalog(baseEnvironment, () => pool)).rejects.toThrow(
      /não existe ou está arquivado/,
    );
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO equipment'))).toBe(false);
  });

  it('recusa responsável sem usuário ativo', async () => {
    const { pool } = fakePool({ actorRows: [] });

    await expect(runImportEquipmentCatalog(baseEnvironment, () => pool)).rejects.toThrow(
      /Nenhum usuário ativo/,
    );
  });

  it('importa sem patrimônio nem número de série e preserva o que já existe', async () => {
    const { pool, calls } = fakePool({});

    const result = await runImportEquipmentCatalog(baseEnvironment, () => pool);

    expect(result.created).toHaveLength(CP2B_EQUIPMENT_CATALOG.length);
    expect(result.skipped).toHaveLength(0);

    const insert = calls.find(({ sql }) => sql.includes('INSERT INTO equipment'));
    expect(insert?.sql).toContain('DO NOTHING');
    expect(insert?.sql).not.toContain('asset_tag');
    expect(insert?.sql).not.toContain('serial_number');
    expect(calls.some(({ sql }) => sql.includes("'equipment.imported'"))).toBe(true);
  });

  it('conta como preservado o equipamento que já estava cadastrado', async () => {
    const { pool, calls } = fakePool({ equipmentInsertRows: [] });

    const result = await runImportEquipmentCatalog(baseEnvironment, () => pool);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(CP2B_EQUIPMENT_CATALOG.length);
    expect(calls.some(({ sql }) => sql.includes("'equipment.imported'"))).toBe(false);
  });

  it('não grava nada em simulação, mas relata o que entraria', async () => {
    const { pool, calls } = fakePool({});

    const result = await runImportEquipmentCatalog(
      { ...baseEnvironment, IMPORT_DRY_RUN: 'true' },
      () => pool,
    );

    expect(result.dryRun).toBe(true);
    expect(result.created).toHaveLength(CP2B_EQUIPMENT_CATALOG.length);
    expect(calls.map(({ sql }) => sql.trim())).toContain('ROLLBACK');
    expect(calls.map(({ sql }) => sql.trim())).not.toContain('COMMIT');
  });
});
