import { describe, expect, it } from 'vitest';

import { buildCP2bReferenceCatalog } from './cp2b-catalog.js';

describe('CP2b reference catalog snapshot', () => {
  it('preserves every non-empty source row with provenance and a content hash', () => {
    const catalog = buildCP2bReferenceCatalog();

    expect(catalog.source.key).toMatch(/^CP2b-reference-/);
    expect(catalog.source.sha256).toHaveLength(64);
    expect(catalog.rows.length).toBeGreaterThan(250);
    expect(catalog.rows.every(({ contentSha256 }) => contentSha256.length === 64)).toBe(true);
    expect(catalog.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheetName: 'Reagentes', rowNumber: 3 }),
        expect.objectContaining({ sheetName: 'Quadro de Áreas', rowNumber: 3 }),
        expect.objectContaining({ sheetName: 'Levantamento Mobiliário', rowNumber: 90 }),
      ]),
    );
  });

  it('creates selectable options without creating operational products, lots or equipment', () => {
    const catalog = buildCP2bReferenceCatalog();
    const kinds = new Set(catalog.options.map(({ kind }) => kind));

    expect(kinds).toEqual(
      new Set([
        'REAGENT',
        'MATERIAL',
        'EQUIPMENT_TYPE',
        'EQUIPMENT_MODEL',
        'SPACE',
        'BENCH',
        'FURNITURE',
        'PLANNING_ASSUMPTION',
      ]),
    );
    expect(catalog.options.some(({ label }) => label === 'Nexis GC-2030')).toBe(true);
    expect(catalog.options.some(({ label }) => label === 'Laboratório 1')).toBe(true);
    expect(catalog.options.some(({ kind }) => kind === ('PRODUCT' as never))).toBe(false);
    expect(catalog.options.some(({ kind }) => kind === ('LOT' as never))).toBe(false);
    expect(catalog.options.some(({ kind }) => kind === ('EQUIPMENT' as never))).toBe(false);
  });

  it('removes credentials, tracking parameters and fragments from reference URLs', () => {
    const catalog = buildCP2bReferenceCatalog();
    const option = catalog.options.find(({ label }) => label.includes('Fisatom 752A'));

    expect(option?.details.referenceUrl).toBe(
      'https://www.7lab.com.br/equipamentos/agitador-magnetico-com-aquecimento/agitador-magnetico-com-aquecimento-fisatom-752a-4-litros',
    );
  });
});
