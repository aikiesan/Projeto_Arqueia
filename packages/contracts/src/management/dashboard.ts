import { z } from 'zod';

import { equipmentStatusSchema } from '../equipment/equipment.js';
import { uuidSchema } from '../common/entity.js';

export const dashboardEquipmentSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    byStatus: z.record(equipmentStatusSchema, z.number().int().nonnegative()),
  })
  .strict();

export const dashboardAvailabilitySchema = z
  .object({
    scheduling: z.boolean(),
    inventory: z.boolean(),
    maintenance: z.boolean(),
  })
  .strict();

export const dashboardSummarySchema = z
  .object({
    laboratoryId: uuidSchema,
    equipmentSummary: dashboardEquipmentSummarySchema,
    todayReservations: z.array(z.never()),
    upcomingActions: z.array(z.never()),
    inventoryAlerts: z.array(z.never()),
    availability: dashboardAvailabilitySchema,
    generatedAt: z.string().datetime(),
  })
  .strict();

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
