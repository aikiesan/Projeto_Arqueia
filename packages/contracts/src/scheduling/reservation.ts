import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const reservationStatuses = ['CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;
export const reservationStatusSchema = z.enum(reservationStatuses);

export const CANCELLATION_MINIMUM_NOTICE_MINUTES = 30;

export const recurrenceFrequencies = [
  'NONE',
  'DAILY',
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'CUSTOM',
] as const;
export const recurrenceFrequencySchema = z.enum(recurrenceFrequencies);

export const recurrenceRuleSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    weekdays: z.array(z.number().int().min(0).max(6)).optional().default([]),
    untilDate: timestampSchema.optional().nullable().default(null),
  })
  .strict();

export const timeRangeSchema = z
  .object({
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora de início deve ser anterior à data/hora de término.',
  );

export const reservationFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  equipmentId: uuidSchema,
  userId: uuidSchema,
  projectId: uuidSchema,
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  status: reservationStatusSchema,
  purpose: z.string().trim().min(2).max(500),
  sampleCount: z.coerce.number().int().min(1).max(10_000).nullable().default(null),
  notes: z.string().trim().max(2_000).nullable().default(null),
  cancelledAt: timestampSchema.nullable().default(null),
  cancelledByUserId: uuidSchema.nullable().default(null),
  cancellationReason: z.string().trim().max(500).nullable().default(null),
});

export const reservationSchema = entityMetadataSchema
  .extend(reservationFieldsSchema.shape)
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora de início deve ser anterior à data/hora de término.',
  );

export const createReservationInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    equipmentId: uuidSchema,
    projectId: uuidSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    purpose: z.string().trim().min(2).max(500),
    sampleCount: z.coerce.number().int().min(1).max(10_000).nullable().optional().default(null),
    notes: z.string().trim().max(2_000).nullable().optional().default(null),
    recurrence: recurrenceRuleSchema.optional().default({ frequency: 'NONE', weekdays: [], untilDate: null }),
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora de início deve ser anterior à data/hora de término.',
  );

export const conflictingSlotSchema = z.object({
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  reason: z.string(),
});

export const createReservationResultSchema = z.object({
  createdReservations: z.array(reservationSchema),
  conflictingSlots: z.array(conflictingSlotSchema),
});

export const cancelReservationInputSchema = z
  .object({
    reservationId: uuidSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const reservationParamsSchema = z.object({ reservationId: uuidSchema }).strict();
export const reservationPageSchema = createCursorPageSchema(reservationSchema).strict();

export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type CreateReservationInput = z.input<typeof createReservationInputSchema>;
export type ConflictingSlot = z.infer<typeof conflictingSlotSchema>;
export type CreateReservationResult = z.infer<typeof createReservationResultSchema>;
export type CancelReservationInput = z.input<typeof cancelReservationInputSchema>;
export type ReservationPage = z.infer<typeof reservationPageSchema>;
