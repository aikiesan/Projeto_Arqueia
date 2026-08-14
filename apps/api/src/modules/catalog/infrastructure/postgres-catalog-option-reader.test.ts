import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresCatalogOptionReader } from './postgres-catalog-option-reader.js';

const labId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const optionId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function row() {
  const now = new Date('2026-08-14T00:00:00.000Z');
  return {
    id: optionId,
    laboratory_id: labId,
    parent_option_id: null,
    kind: 'EQUIPMENT_MODEL',
    code: null,
    label: 'Centrífuga refrigerada',
    category: 'Equipamentos de bancada',
    description: null,
    details: { voltage: '220 V' },
    is_selectable: true,
    source_key: 'CP2b-reference-2026-08-14',
    sheet_name: 'Equipamentos',
    row_number: 34,
    source_column: 'B',
    created_at: now,
    updated_at: now,
    archived_at: null,
    values: ['segredo que nunca deve sair'],
    display_name: 'caminho/local/sensivel.xlsx',
  };
}

describe('PostgresCatalogOptionReader', () => {
  it('uses laboratory-scoped parameterized SQL and does not leak raw source values', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row()] });
    const pool = { query } as unknown as DatabasePool;

    const result = await new PostgresCatalogOptionReader(pool).list({
      laboratoryId: labId,
      kind: 'EQUIPMENT_MODEL',
      search: "100%_'; DROP TABLE catalog_options; --",
      limit: 25,
    });

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('co.laboratory_id = $1');
    expect(sql).toContain('co.kind = $2');
    expect(sql).not.toContain('DROP TABLE');
    expect(parameters[0]).toBe(labId);
    expect(parameters[1]).toBe('EQUIPMENT_MODEL');
    expect(parameters[2]).toBe("%100\\%\\_'; DROP TABLE catalog\\_options; --%");
    expect(result.items[0]).not.toHaveProperty('values');
    expect(result.items[0]?.source).toEqual({
      key: 'CP2b-reference-2026-08-14',
      sheet: 'Equipamentos',
      row: 34,
      column: 'B',
    });
  });

  it('returns a stable keyset cursor and fetches only limit plus one', async () => {
    const rows = [row(), { ...row(), id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8' }];
    const query = vi.fn().mockResolvedValue({ rows });
    const pool = { query } as unknown as DatabasePool;

    const result = await new PostgresCatalogOptionReader(pool).list({
      laboratoryId: labId,
      kind: 'EQUIPMENT_MODEL',
      cursor: optionId,
      limit: 1,
    });

    expect(query.mock.calls[0]?.[1]).toEqual([labId, 'EQUIPMENT_MODEL', null, optionId, 2]);
    expect(result.pageInfo).toEqual({ hasNextPage: true, nextCursor: optionId });
    expect(result.items).toHaveLength(1);
  });
});
