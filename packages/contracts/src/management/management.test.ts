import { describe, expect, it } from 'vitest';

import {
  decodeAuditCursor,
  dashboardSummarySchema,
  encodeAuditCursor,
  listAuditLogsQuerySchema,
  managementAnalyticsQuerySchema,
  projectUsageQuerySchema,
  projectUsageSummarySchema,
} from './index.js';

describe('Management Contracts Unit Tests (Canonical Plan)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';

  it('accepts a connected dashboard with reservations and inventory alerts', () => {
    const result = dashboardSummarySchema.parse({
      laboratoryId: labId,
      timezone: 'America/Sao_Paulo',
      equipmentSummary: { total: 1, byStatus: { AVAILABLE: 1, UNDER_EVALUATION: 0, UNAVAILABLE: 0, MAINTENANCE: 0 } },
      todayReservations: [{ id: labId, equipmentId: labId, equipmentName: 'HPLC', startsAt: '2026-08-14T12:00:00.000Z', endsAt: '2026-08-14T13:00:00.000Z', purpose: 'Análise', status: 'CONFIRMED' }],
      upcomingActions: [],
      inventoryAlerts: [{ kind: 'LOW_STOCK', productId: labId, productName: 'Acetona', batchId: null, batchNumber: null, detail: 'Saldo abaixo do mínimo' }],
      availability: { scheduling: true, inventory: true, maintenance: true },
      generatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(result.todayReservations).toHaveLength(1);
    expect(result.inventoryAlerts).toHaveLength(1);
  });

  it('accepts valid semi-open interval [startsAt, endsAt) within 90 days', () => {
    const validQuery = {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-31T23:59:59.999Z',
    };

    const parsed = managementAnalyticsQuerySchema.parse(validQuery);
    expect(parsed.laboratoryId).toBe(labId);
  });

  it('rejects query where endsAt <= startsAt', () => {
    const invalidQuery = {
      laboratoryId: labId,
      startsAt: '2026-08-31T00:00:00.000Z',
      endsAt: '2026-08-01T00:00:00.000Z',
    };

    expect(() => managementAnalyticsQuerySchema.parse(invalidQuery)).toThrow(
      'A data final deve ser estritamente posterior à data inicial (intervalo semiaberto).',
    );
  });

  it('rejects interval exceeding 90 days cap', () => {
    const hugeQuery = {
      laboratoryId: labId,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-06-01T00:00:00.000Z',
    };

    expect(() => managementAnalyticsQuerySchema.parse(hugeQuery)).toThrow(
      'O período do relatório não pode exceder 90 dias.',
    );
  });

  it('encodes and decodes opaque versioned audit cursors', () => {
    const payload = {
      v: 1 as const,
      occurredAt: '2026-08-14T12:00:00.000Z',
      id: '55555555-5555-4555-a555-555555555555',
      filterHash: 'abc123hash',
    };

    const encoded = encodeAuditCursor(payload);
    expect(typeof encoded).toBe('string');

    const decoded = decodeAuditCursor(encoded);
    expect(decoded).toEqual(payload);

    expect(decodeAuditCursor('invalid-cursor-str')).toBeNull();
  });

  it('validates project usage query and summary schemas', () => {
    const pQuery = {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
      limit: 20,
    };
    const parsedQuery = projectUsageQuerySchema.parse(pQuery);
    expect(parsedQuery.limit).toBe(20);

    const projectSummary = {
      projectId: '22222222-2222-4222-a222-222222222222',
      projectCode: 'PROJ-BIO-2026',
      projectName: 'Pesquisa em Biocatalisadores',
      reservedHours: 42.5,
      reservationCount: 12,
      withdrawalCount: 5,
      consumedProducts: [
        {
          productId: '55555555-5555-4555-a555-555555555555',
          productCode: 'ACT-PA',
          productName: 'Acetona PA',
          unitOfMeasure: 'ML' as const,
          totalQuantity: 1500,
        },
      ],
    };

    const parsedSummary = projectUsageSummarySchema.parse(projectSummary);
    expect(parsedSummary.consumedProducts.length).toBe(1);
  });

  it('validates audit log list query parameters', () => {
    const auditQuery = {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
      limit: 50,
    };

    const parsed = listAuditLogsQuerySchema.parse(auditQuery);
    expect(parsed.limit).toBe(50);
  });
});
