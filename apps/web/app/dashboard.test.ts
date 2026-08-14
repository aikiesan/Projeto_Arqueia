import type { Equipment } from '@arqueia/contracts';
import { describe, expect, it } from 'vitest';

import { createDashboardSummary, createUnavailableDashboardSummary } from './dashboard';

const laboratoryId = '00000000-0000-4000-8000-000000000004';
const metadata = { createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', archivedAt: null } as const;

function equipment(id: string, status: Equipment['status']): Equipment {
  return {
    ...metadata, id, laboratoryId, status,
    catalogOptionId: '00000000-0000-4000-8000-000000000010', spaceOptionId: null, benchOptionId: null, responsibleUserId: null,
    code: `CP2b-${id.slice(-1)}`, name: 'Equipamento', assetTag: null, serialNumber: null, notes: null,
    reservationPolicy: { maxReservationMinutes: 720, requiresTraining: true, requiresApproval: false, absenceReleaseMinutes: 30 },
  };
}

describe('createDashboardSummary', () => {
  it('deriva os totais exclusivamente dos equipamentos recebidos', () => {
    const summary = createDashboardSummary(laboratoryId, [
      equipment('00000000-0000-4000-8000-000000000011', 'AVAILABLE'),
      equipment('00000000-0000-4000-8000-000000000012', 'MAINTENANCE'),
    ], new Date('2026-08-14T10:00:00.000Z'));
    expect(summary.equipmentSummary).toEqual({ total: 2, byStatus: { AVAILABLE: 1, UNDER_EVALUATION: 0, UNAVAILABLE: 0, MAINTENANCE: 1 } });
    expect(summary.todayReservations).toEqual([]);
    expect(summary.availability.scheduling).toBe(false);
  });

  it('não apresenta zeros como dados reais quando o dashboard está indisponível', () => {
    const summary = createUnavailableDashboardSummary(
      laboratoryId,
      'America/Sao_Paulo',
      new Date('2026-08-14T10:00:00.000Z'),
    );

    expect(summary.equipmentSummary.total).toBe(0);
    expect(Object.values(summary.availability)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(summary.timezone).toBe('America/Sao_Paulo');
  });
});
