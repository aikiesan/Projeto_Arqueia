import { describe, expect, it } from 'vitest';

import { summarizeFieldReports } from './field-report-summary.js';

const laboratoryId = '11111111-1111-4111-a111-111111111111';

describe('summarizeFieldReports', () => {
  it('conta como aberto tudo que não foi resolvido e destaca o que impede o uso', () => {
    const summary = summarizeFieldReports(laboratoryId, [
      { kind: 'EQUIPMENT_PROBLEM', status: 'NEW', blocksUse: true, count: 2 },
      { kind: 'EQUIPMENT_PROBLEM', status: 'IN_REVIEW', blocksUse: false, count: 1 },
      { kind: 'EQUIPMENT_PROBLEM', status: 'RESOLVED', blocksUse: true, count: 5 },
      { kind: 'SUPPLY_USAGE', status: 'NEW', blocksUse: false, count: 3 },
      { kind: 'GENERAL_SUPPORT', status: 'RESOLVED', blocksUse: false, count: 4 },
    ]);

    expect(summary).toEqual({
      laboratoryId,
      openByKind: {
        EQUIPMENT_PROBLEM: 3,
        MAINTENANCE_REQUEST: 0,
        SUPPLY_USAGE: 3,
        GENERAL_SUPPORT: 0,
      },
      byStatus: { NEW: 5, IN_REVIEW: 1, RESOLVED: 9 },
      openBlockingUse: 2,
    });
  });

  it('devolve zeros para um laboratório sem informes', () => {
    const summary = summarizeFieldReports(laboratoryId, []);

    expect(Object.values(summary.openByKind)).toEqual([0, 0, 0, 0]);
    expect(summary.openBlockingUse).toBe(0);
  });
});
