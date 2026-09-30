import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresFieldReportRepository } from './postgres-field-report-repository.js';

const laboratoryId = '11111111-1111-4111-a111-111111111111';

describe('PostgresFieldReportRepository', () => {
  it('mantém laboratório, filtros e cursor em parâmetros SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    await new PostgresFieldReportRepository(pool).list({
      laboratoryId,
      kind: 'SUPPLY_USAGE',
      status: 'NEW',
      limit: 10,
    });

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('fr.laboratory_id = $1');
    expect(sql).toContain('fr.archived_at IS NULL');
    expect(sql).toContain('ORDER BY fr.created_at DESC, fr.id DESC');
    expect(parameters).toEqual([laboratoryId, 'SUPPLY_USAGE', 'NEW', null, 11]);
  });

  it('o formulário público lê do equipamento só id, código e nome', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: laboratoryId, code: 'CP2b', name: 'Laboratório CP2b' }] })
      .mockResolvedValueOnce({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    const form = await new PostgresFieldReportRepository(pool).findPublicForm(laboratoryId);

    const [equipmentSql] = query.mock.calls[1] as [string];
    expect(equipmentSql).toMatch(/SELECT id, code, name\s+FROM equipment/);
    expect(equipmentSql).toContain('archived_at IS NULL');
    expect(form).toEqual({
      laboratory: { id: laboratoryId, code: 'CP2b', name: 'Laboratório CP2b' },
      equipment: [],
    });
  });

  it('não monta formulário para laboratório arquivado ou inexistente', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as DatabasePool;

    await expect(new PostgresFieldReportRepository(pool).findPublicForm(laboratoryId)).resolves.toBeNull();
    expect(query).toHaveBeenCalledOnce();
  });
});
