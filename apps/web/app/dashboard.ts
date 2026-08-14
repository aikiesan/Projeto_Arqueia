import {
  dashboardSummarySchema,
  type DashboardSummary,
  type Equipment,
} from '@arqueia/contracts';

export function createDashboardSummary(
  laboratoryId: string,
  equipment: readonly Equipment[],
  generatedAt = new Date(),
  timezone = 'America/Sao_Paulo',
): DashboardSummary {
  const byStatus = {
    AVAILABLE: 0,
    UNDER_EVALUATION: 0,
    UNAVAILABLE: 0,
    MAINTENANCE: 0,
  };
  for (const item of equipment) byStatus[item.status] += 1;

  return dashboardSummarySchema.parse({
    laboratoryId,
    timezone,
    equipmentSummary: { total: equipment.length, byStatus },
    todayReservations: [],
    upcomingActions: [],
    inventoryAlerts: [],
    quickActions: [],
    availability: {
      equipment: true,
      scheduling: false,
      inventory: false,
      maintenance: false,
      pendingActions: false,
    },
    generatedAt: generatedAt.toISOString(),
  });
}

export function createUnavailableDashboardSummary(
  laboratoryId: string,
  timezone: string,
  generatedAt = new Date(),
): DashboardSummary {
  return dashboardSummarySchema.parse({
    laboratoryId,
    timezone,
    equipmentSummary: {
      total: 0,
      byStatus: {
        AVAILABLE: 0,
        UNDER_EVALUATION: 0,
        UNAVAILABLE: 0,
        MAINTENANCE: 0,
      },
    },
    todayReservations: [],
    upcomingActions: [],
    inventoryAlerts: [],
    quickActions: [],
    availability: {
      equipment: false,
      scheduling: false,
      inventory: false,
      maintenance: false,
      pendingActions: false,
    },
    generatedAt: generatedAt.toISOString(),
  });
}
