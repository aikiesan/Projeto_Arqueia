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
