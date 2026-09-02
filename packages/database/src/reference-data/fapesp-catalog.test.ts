import { describe, expect, it } from 'vitest';

import { buildFapespCatalog } from './fapesp-catalog.js';

describe('FAPESP reference catalog snapshot (Profa. Bruna)', () => {
  it('preserves source provenance and SHA-256 content hashes for all rows', () => {
    const catalog = buildFapespCatalog();

    expect(catalog.source.key).toMatch(/^FAPESP-Bruna-Moraes-Consolidado-/);
    expect(catalog.source.sha256).toBe('81b709e43303a81da6e8cc0905bff220b580d64efbe63ede218929adc38cede5');
    expect(catalog.rows.length).toBeGreaterThan(250);
    expect(catalog.rows.every(({ contentSha256 }) => contentSha256.length === 64)).toBe(true);

    expect(catalog.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheetName: 'Inventario', rowNumber: 2 }),
        expect.objectContaining({ sheetName: 'Aquisicoes', rowNumber: 2 }),
        expect.objectContaining({ sheetName: 'Servicos', rowNumber: 2 }),
        expect.objectContaining({ sheetName: 'Propostas', rowNumber: 2 }),
        expect.objectContaining({ sheetName: 'Documentos', rowNumber: 2 }),
      ]),
    );
  });

  it('generates well-formed options for all categories without duplicates', () => {
    const catalog = buildFapespCatalog();
    const kinds = new Set(catalog.options.map(({ kind }) => kind));

    expect(kinds).toEqual(
      new Set(['EQUIPMENT_TYPE', 'EQUIPMENT_MODEL', 'REAGENT', 'MATERIAL', 'PLANNING_ASSUMPTION']),
    );

    // Equipments
    const dr6000 = catalog.options.find((o) => o.label.includes('DR6000'));
    expect(dr6000).toBeDefined();
    expect(dr6000?.kind).toBe('EQUIPMENT_MODEL');
    expect(dr6000?.details.brand).toBe('Hach');

    const shimadzu = catalog.options.find((o) => o.label.includes('GC-2030NS'));
    expect(shimadzu).toBeDefined();
    expect(shimadzu?.kind).toBe('EQUIPMENT_MODEL');
    expect(shimadzu?.details.brand).toBe('Shimadzu');

    const mufla = catalog.options.find((o) => o.label.includes('F2-DM'));
    expect(mufla).toBeDefined();
    expect(mufla?.kind).toBe('EQUIPMENT_MODEL');
    expect(mufla?.details.brand).toBe('Adamo');

    // Reagents
    const edta = catalog.options.find((o) => o.label.includes('EDTA'));
    expect(edta).toBeDefined();
    expect(edta?.kind).toBe('REAGENT');

    const nanoFe = catalog.options.find((o) => o.label.includes('ferro(II,III) nanoparticulado'));
    expect(nanoFe).toBeDefined();
    expect(nanoFe?.kind).toBe('REAGENT');

    // Materials
    const hamilton1L = catalog.options.find((o) => o.label.includes('Hamilton 1 L'));
    expect(hamilton1L).toBeDefined();
    expect(hamilton1L?.kind).toBe('MATERIAL');

    // Proposals & Services
    const bodProposal = catalog.options.find((o) => o.code === 'PROP-SRV-003');
    expect(bodProposal).toBeDefined();
    expect(bodProposal?.kind).toBe('PLANNING_ASSUMPTION');
  });

  it('ensures all option keys are unique', () => {
    const catalog = buildFapespCatalog();
    const keys = catalog.options.map((o) => o.optionKey);
    const uniqueKeys = new Set(keys);

    expect(keys.length).toBe(uniqueKeys.size);
  });
});
