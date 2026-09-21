import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresEquipmentRepository } from './postgres-equipment-repository.js';

describe('PostgresEquipmentRepository', () => {
  it('keeps laboratory, status and hostile search input in SQL parameters', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;
    const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

    await new PostgresEquipmentRepository(pool).list({
      laboratoryId,
      status: 'AVAILABLE',
      search: "100%_'; DROP TABLE equipment; --",
      limit: 25,
    });

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('e.laboratory_id = $1');
    expect(sql).not.toContain('DROP TABLE');
    expect(parameters).toEqual([
      laboratoryId,
      'AVAILABLE',
      "%100\\%\\_'; DROP TABLE equipment; --%",
      null,
      26,
    ]);
  });
});

describe('PostgresEquipmentRepository.findActiveByQrIdentifier', () => {
  const equipmentId = '8f555951-9dc0-41d1-b245-5ffdce74fad2';

  it('busca pelo id quando a etiqueta grava um UUID', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    await new PostgresEquipmentRepository(pool).findActiveByQrIdentifier(equipmentId);

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('id = $1::uuid');
    expect(sql).toContain('archived_at IS NULL');
    expect(parameters).toEqual([equipmentId]);
  });

  /**
   * Regressão: `WHERE id = $1::uuid` com um código legível faz o Postgres
   * abortar com `invalid input syntax for type uuid` — o endpoint devolveria
   * 500 em vez de 404 para qualquer etiqueta com código em vez de UUID.
   */
  it('não tenta converter código legível para uuid', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    await new PostgresEquipmentRepository(pool).findActiveByQrIdentifier('CP2b-HPLC-01');

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('::uuid');
    expect(sql).toContain('upper(code) = upper($1)');
    expect(parameters).toEqual(['CP2b-HPLC-01']);
  });

  /**
   * `code` é único por laboratório, não globalmente. Com dois candidatos, um
   * `LIMIT 1` abriria o equipamento de outro laboratório — silenciosamente.
   */
  it('recusa código ambíguo entre laboratórios em vez de escolher um', async () => {
    const row = { id: equipmentId } as unknown;
    const query = vi.fn().mockResolvedValue({ rows: [row, row] });
    const pool = { query } as unknown as DatabasePool;

    const found = await new PostgresEquipmentRepository(pool).findActiveByQrIdentifier('CP2b-HPLC-01');

    expect(found).toBeNull();
    expect((query.mock.calls[0] as [string, unknown[]])[0]).toContain('LIMIT 2');
  });

  it('não devolve equipamento arquivado', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    const found = await new PostgresEquipmentRepository(pool).findActiveByQrIdentifier('QUALQUER');

    expect(found).toBeNull();
    expect((query.mock.calls[0] as [string, unknown[]])[0]).toContain('archived_at IS NULL');
  });
});
