import { z } from 'zod';

import { equipmentStatusSchema } from '../equipment/equipment.js';
import { timestampSchema, uuidSchema } from '../common/entity.js';
import { reservationStatusSchema } from '../scheduling/reservation.js';

export const DASHBOARD_LIST_LIMIT = 8;

const internalHrefSchema = z.string().trim().min(1).max(500).startsWith('/');

export const dashboardReservationSchema = z
  .object({
    id: uuidSchema,
    equipmentId: uuidSchema,
    equipmentName: z.string().trim().min(1).max(200),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    purpose: z.string().trim().min(1).max(500),
    status: reservationStatusSchema,
    href: internalHrefSchema,
  })
  .strict()
  .refine(({ startsAt, endsAt }) => Date.parse(startsAt) < Date.parse(endsAt), {
    message: 'A reserva da Home deve possuir startsAt anterior a endsAt.',
  });

export const dashboardInventoryAlertSchema = z
  .object({
    kind: z.enum(['LOW_STOCK', 'EXPIRING', 'EXPIRED']),
    productId: uuidSchema,
    productName: z.string().trim().min(1).max(200),
    batchId: uuidSchema.nullable(),
    batchNumber: z.string().trim().min(1).max(120).nullable(),
    detail: z.string().trim().min(1).max(500),
    href: internalHrefSchema,
  })
  .strict();

export const dashboardPendingActionSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    kind: z.enum([
      'EQUIPMENT_ATTENTION',
      'RESERVATION_ATTENTION',
      'INVENTORY_ATTENTION',
    ]),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(500),
    href: internalHrefSchema,
  })
  .strict();

export const dashboardQuickActionSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100),
    href: internalHrefSchema,
  })
  .strict();

export const dashboardEquipmentSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    byStatus: z.record(equipmentStatusSchema, z.number().int().nonnegative()),
  })
  .strict();

export const dashboardAvailabilitySchema = z
  .object({
    equipment: z.boolean(),
    scheduling: z.boolean(),
    inventory: z.boolean(),
    maintenance: z.boolean(),
    pendingActions: z.boolean(),
  })
  .strict();

export const dashboardSummarySchema = z
  .object({
    laboratoryId: uuidSchema,
    timezone: z.string().trim().min(1).max(80),
    equipmentSummary: dashboardEquipmentSummarySchema,
    todayReservations: z.array(dashboardReservationSchema).max(DASHBOARD_LIST_LIMIT),
    upcomingActions: z.array(dashboardPendingActionSchema).max(DASHBOARD_LIST_LIMIT),
    inventoryAlerts: z.array(dashboardInventoryAlertSchema).max(DASHBOARD_LIST_LIMIT),
    quickActions: z.array(dashboardQuickActionSchema).max(6),
    availability: dashboardAvailabilitySchema,
    generatedAt: timestampSchema,
  })
  .strict();

export type DashboardReservation = z.infer<typeof dashboardReservationSchema>;
export type DashboardInventoryAlert = z.infer<typeof dashboardInventoryAlertSchema>;
export type DashboardPendingAction = z.infer<typeof dashboardPendingActionSchema>;
export type DashboardQuickAction = z.infer<typeof dashboardQuickActionSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
