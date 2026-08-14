import { z } from 'zod';

import { timestampSchema, uuidSchema } from '../common/entity.js';
import { reservationStatusSchema } from './reservation.js';
import { technicalBlockReasonSchema, technicalBlockStatusSchema } from './technical-block.js';

export const listScheduleQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    equipmentId: uuidSchema.optional(),
    onlyMine: z.coerce.boolean().optional().default(false),
    includeCancelled: z.coerce.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora inicial de consulta deve ser anterior à data/hora final.',
  );

export const scheduleItemTypes = ['RESERVATION', 'TECHNICAL_BLOCK'] as const;
export const scheduleItemTypeSchema = z.enum(scheduleItemTypes);

export const scheduleReservationDetailsSchema = z
  .object({
    reservationId: uuidSchema,
    userId: uuidSchema,
    userName: z.string().nullable().optional(),
    projectId: uuidSchema,
    projectCode: z.string().nullable().optional(),
    purpose: z.string(),
    sampleCount: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: reservationStatusSchema,
  })
  .strict();

export const scheduleBlockDetailsSchema = z
  .object({
    technicalBlockId: uuidSchema,
    reason: technicalBlockReasonSchema,
    description: z.string(),
    createdByUserId: uuidSchema,
    status: technicalBlockStatusSchema,
  })
  .strict();

export const scheduleItemSchema = z
  .object({
    id: uuidSchema,
    type: scheduleItemTypeSchema,
    equipmentId: uuidSchema,
    equipmentName: z.string().optional(),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    title: z.string(),
    status: z.string(),
    isMine: z.boolean(),
    reservationDetails: scheduleReservationDetailsSchema.nullable().optional(),
    blockDetails: scheduleBlockDetailsSchema.nullable().optional(),
  })
  .strict();

export const scheduleResponseSchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    items: z.array(scheduleItemSchema),
  })
  .strict();

export const conflictErrorCode = 'RESERVATION_SLOT_CONFLICT' as const;

export const conflictErrorResponseSchema = z
  .object({
    code: z.literal(conflictErrorCode),
    message: z.string(),
    conflictingSlot: z
      .object({
        startsAt: timestampSchema,
        endsAt: timestampSchema,
        type: scheduleItemTypeSchema,
      })
      .strict(),
  })
  .strict();

export type ListScheduleQuery = z.input<typeof listScheduleQuerySchema>;
export type ScheduleItemType = z.infer<typeof scheduleItemTypeSchema>;
export type ScheduleReservationDetails = z.infer<typeof scheduleReservationDetailsSchema>;
export type ScheduleBlockDetails = z.infer<typeof scheduleBlockDetailsSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type ConflictErrorResponse = z.infer<typeof conflictErrorResponseSchema>;
