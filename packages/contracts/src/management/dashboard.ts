import { z } from 'zod';

import { equipmentStatusSchema } from '../equipment/equipment.js';
import { timestampSchema, uuidSchema } from '../common/entity.js';
import { reservationStatusSchema } from '../scheduling/reservation.js';

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

export const dashboardReservationSchema = z.object({
  id: uuidSchema,
  equipmentId: uuidSchema,
  equipmentName: z.string().min(1).max(180),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  purpose: z.string().min(1).max(500),
  status: reservationStatusSchema,
}).strict();

export const dashboardInventoryAlertSchema = z.object({
  kind: z.enum(['LOW_STOCK', 'EXPIRING', 'EXPIRED']),
  productId: uuidSchema,
  productName: z.string().min(1).max(180),
  batchId: uuidSchema.nullable(),
  batchNumber: z.string().min(1).max(80).nullable(),
  detail: z.string().min(1).max(240),
}).strict();

export const dashboardUpcomingActionSchema = z.object({
  kind: z.literal('EQUIPMENT_ATTENTION'),
  entityId: uuidSchema,
  title: z.string().min(1).max(180),
  detail: z.string().min(1).max(240),
  href: z.string().startsWith('/'),
}).strict();

export const dashboardSummarySchema = z
  .object({
    laboratoryId: uuidSchema,
    timezone: z.string().min(1).max(80),
    equipmentSummary: dashboardEquipmentSummarySchema,
    todayReservations: z.array(dashboardReservationSchema).max(8),
    upcomingActions: z.array(dashboardUpcomingActionSchema).max(8),
    inventoryAlerts: z.array(dashboardInventoryAlertSchema).max(8),
    availability: dashboardAvailabilitySchema,
    generatedAt: z.string().datetime(),
  })
  .strict();

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type DashboardReservation = z.infer<typeof dashboardReservationSchema>;
export type DashboardInventoryAlert = z.infer<typeof dashboardInventoryAlertSchema>;
export type DashboardUpcomingAction = z.infer<typeof dashboardUpcomingActionSchema>;
