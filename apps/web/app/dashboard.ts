import {
  dashboardSummarySchema,
  type DashboardSummary,
  type Equipment,
} from '@arqueia/contracts';

export function createDashboardSummary(
  laboratoryId: string,
  equipment: readonly Equipment[],
  generatedAt = new Date(),
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
    equipmentSummary: { total: equipment.length, byStatus },
    todayReservations: [],
    upcomingActions: [],
    inventoryAlerts: [],
    availability: { scheduling: false, inventory: false, maintenance: false },
    generatedAt: generatedAt.toISOString(),
  });
}
