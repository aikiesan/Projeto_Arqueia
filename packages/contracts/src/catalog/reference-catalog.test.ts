import { describe, expect, it } from 'vitest';

import {
  canonicalizeArqueiaCode,
  catalogOptionSchema,
  listCatalogOptionsQuerySchema,
} from '../index.js';

const uuid = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

describe('reference catalog contract', () => {
  it('accepts a bounded, typed catalog option without leaking raw source rows', () => {
    const parsed = catalogOptionSchema.parse({
      id: uuid,
      laboratoryId: uuid,
      parentOptionId: null,
      kind: 'EQUIPMENT_MODEL',
      code: null,
      label: 'Nexis GC-2030',
      category: 'CG Shimadzu',
      description: null,
      details: { voltage: '220', powerWatts: 3000 },
      isSelectable: true,
      source: { key: 'cp2b-reference-2026-08-14', sheet: 'Demanda elétrica', row: 38, column: 'B' },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    });

    expect(parsed.details).toEqual({ voltage: '220', powerWatts: 3000 });
    expect(parsed).not.toHaveProperty('rawSourceRow');
  });

  it('rejects unbounded queries and unknown fields', () => {
    expect(() =>
      listCatalogOptionsQuerySchema.parse({ laboratoryId: uuid, limit: 51 }),
    ).toThrow();
    expect(() =>
      listCatalogOptionsQuerySchema.parse({ laboratoryId: uuid, sql: 'DROP TABLE' }),
    ).toThrow();
  });

  it('keeps the CP2b spelling canonical in internal codes', () => {
    expect(canonicalizeArqueiaCode('cp2b-lab')).toBe('CP2b-LAB');
    expect(canonicalizeArqueiaCode('CP2B-04')).toBe('CP2b-04');
  });
});
