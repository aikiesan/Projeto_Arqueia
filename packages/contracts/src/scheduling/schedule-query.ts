import { z } from 'zod';

import { timestampSchema, uuidSchema } from '../common/entity.js';
import { reservationStatusSchema } from './reservation.js';
import { technicalBlockReasonSchema, technicalBlockStatusSchema } from './technical-block.js';

export const SCHEDULE_QUERY_MAX_DAYS = 42;
export const SCHEDULE_ITEM_LIMIT = 1_000;

const queryBooleanSchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const scheduleItemStatuses = ['CONFIRMED', 'ACTIVE', 'CANCELLED', 'COMPLETED'] as const;
export const scheduleItemStatusSchema = z.enum(scheduleItemStatuses);

export const listScheduleQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    equipmentId: uuidSchema.optional(),
    status: scheduleItemStatusSchema.optional(),
    onlyMine: queryBooleanSchema.optional().default(false),
    includeCancelled: queryBooleanSchema.optional().default(false),
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora inicial de consulta deve ser anterior à data/hora final.',
  )
  .refine(
    (data) =>
      new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime() <=
      SCHEDULE_QUERY_MAX_DAYS * 24 * 60 * 60 * 1_000,
    `A consulta de agenda não pode exceder ${SCHEDULE_QUERY_MAX_DAYS} dias.`,
  );

export const scheduleItemTypes = ['RESERVATION', 'TECHNICAL_BLOCK'] as const;
export const scheduleItemTypeSchema = z.enum(scheduleItemTypes);

export const scheduleReservationDetailsSchema = z
  .object({
    reservationId: uuidSchema,
    userId: uuidSchema,
    userName: z.string().trim().min(1).max(200).nullable().optional(),
    projectId: uuidSchema,
    projectCode: z.string().trim().min(1).max(48).nullable().optional(),
    purpose: z.string().trim().min(2).max(500),
    sampleCount: z.number().int().min(1).max(10_000).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
    status: reservationStatusSchema,
  })
  .strict();

export const scheduleBlockDetailsSchema = z
  .object({
    technicalBlockId: uuidSchema,
    reason: technicalBlockReasonSchema,
    description: z.string().trim().min(3).max(1_000),
    createdByUserId: uuidSchema,
    status: technicalBlockStatusSchema,
  })
  .strict();

export const scheduleItemSchema = z
  .object({
    id: uuidSchema,
    type: scheduleItemTypeSchema,
    equipmentId: uuidSchema,
    equipmentName: z.string().trim().min(1).max(200),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    title: z.string().trim().min(1).max(500),
    status: scheduleItemStatusSchema,
    isMine: z.boolean(),
    canCancel: z.boolean(),
    reservationDetails: scheduleReservationDetailsSchema.nullable().optional(),
    blockDetails: scheduleBlockDetailsSchema.nullable().optional(),
  })
  .strict()
  .refine(
    ({ startsAt, endsAt }) => Date.parse(startsAt) < Date.parse(endsAt),
    'O item da agenda deve possuir startsAt anterior a endsAt.',
  );

export const scheduleCapabilitiesSchema = z
  .object({
    canReserve: z.boolean(),
    canManageBlocks: z.boolean(),
  })
  .strict();

export const scheduleResponseSchema = z
  .object({
    laboratoryId: uuidSchema,
    timezone: z.string().trim().min(1).max(80),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    capabilities: scheduleCapabilitiesSchema,
    items: z.array(scheduleItemSchema).max(SCHEDULE_ITEM_LIMIT),
  })
  .strict();

export const conflictErrorCode = 'RESERVATION_SLOT_CONFLICT' as const;

export const conflictErrorResponseSchema = z
  .object({
    code: z.literal(conflictErrorCode),
    message: z.string().trim().min(1).max(500),
    requestedSlot: z
      .object({
        startsAt: timestampSchema,
        endsAt: timestampSchema,
      })
      .strict()
      .refine(
        ({ startsAt, endsAt }) => Date.parse(startsAt) < Date.parse(endsAt),
        'O intervalo solicitado deve possuir startsAt anterior a endsAt.',
      ),
  })
  .strict();

export type ListScheduleQuery = z.output<typeof listScheduleQuerySchema>;
export type ScheduleItemStatus = z.infer<typeof scheduleItemStatusSchema>;
export type ScheduleItemType = z.infer<typeof scheduleItemTypeSchema>;
export type ScheduleReservationDetails = z.infer<typeof scheduleReservationDetailsSchema>;
export type ScheduleBlockDetails = z.infer<typeof scheduleBlockDetailsSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type ScheduleCapabilities = z.infer<typeof scheduleCapabilitiesSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type ConflictErrorResponse = z.infer<typeof conflictErrorResponseSchema>;
