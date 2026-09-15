import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const reservationStatuses = [
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RELEASED_ABSENCE',
] as const;
export const reservationStatusSchema = z.enum(reservationStatuses);

export const CANCELLATION_MINIMUM_NOTICE_MINUTES = 30;
export const RESERVATION_MINIMUM_DURATION_MINUTES = 30;

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
  startedAt: timestampSchema.nullable().default(null),
  completedAt: timestampSchema.nullable().default(null),
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
  )
  .refine(
    (data) =>
      new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime() >=
      RESERVATION_MINIMUM_DURATION_MINUTES * 60_000,
    `A reserva deve durar no mínimo ${RESERVATION_MINIMUM_DURATION_MINUTES} minutos.`,
  )
  .refine(
    (data) => {
      if (data.recurrence.frequency === 'NONE') return true;
      if (!data.recurrence.untilDate) return false;
      const untilTime = new Date(data.recurrence.untilDate).getTime();
      const startTime = new Date(data.startsAt).getTime();
      if (untilTime < startTime) return false;
      const maxFutureMs = 180 * 24 * 60 * 60 * 1000;
      return untilTime - startTime <= maxFutureMs;
    },
    'Para reservas recorrentes, informe uma data limite válida (até no máximo 180 dias após a data inicial).',
  );

export const startWalkInReservationInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    equipmentId: uuidSchema,
    projectId: uuidSchema,
    durationMinutes: z.coerce.number().int().min(15).max(1440),
    purpose: z.string().trim().min(2).max(500),
    sampleCount: z.coerce.number().int().min(1).max(10_000).nullable().optional().default(null),
    notes: z.string().trim().max(2_000).nullable().optional().default(null),
  })
  .strict();

export const checkInReservationInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    reservationId: uuidSchema,
  })
  .strict();

export const completeReservationInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    reservationId: uuidSchema,
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const releaseAbsentReservationsInputSchema = z
  .object({
    laboratoryId: uuidSchema,
  })
  .strict();

export const releaseAbsentReservationsResultSchema = z
  .object({
    releasedCount: z.number().int().min(0),
    releasedReservationIds: z.array(uuidSchema),
  })
  .strict();

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
    laboratoryId: uuidSchema,
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
export type CreateReservationInput = z.infer<typeof createReservationInputSchema>;
export type StartWalkInReservationInput = z.infer<typeof startWalkInReservationInputSchema>;
export type CheckInReservationInput = z.infer<typeof checkInReservationInputSchema>;
export type CompleteReservationInput = z.infer<typeof completeReservationInputSchema>;
export type ReleaseAbsentReservationsInput = z.infer<typeof releaseAbsentReservationsInputSchema>;
export type ReleaseAbsentReservationsResult = z.infer<typeof releaseAbsentReservationsResultSchema>;
export type ConflictingSlot = z.infer<typeof conflictingSlotSchema>;
export type CreateReservationResult = z.infer<typeof createReservationResultSchema>;
export type CancelReservationInput = z.infer<typeof cancelReservationInputSchema>;
export type ReservationPage = z.infer<typeof reservationPageSchema>;

/**
 * Tolerância para check-in antecipado: o usuário pode registrar presença até
 * CHECK_IN_EARLY_TOLERANCE_MINUTES antes do início da sua reserva.
 *
 * Não existe limite superior próprio: enquanto a reserva não terminar, a vaga
 * segue ocupada por ela (a constraint de exclusão só ignora CANCELLED e
 * RELEASED_ABSENCE), então recusar o check-in por atraso deixaria o equipamento
 * inutilizável por todos. Quem decide ausência é releaseAbsentReservations.
 */
export const CHECK_IN_EARLY_TOLERANCE_MINUTES = 15;

/** Prefixo do código gravado na etiqueta QR física de um equipamento. */
export const EQUIPMENT_QR_PREFIX = 'ARQ-EQP-';

/** Janela consultada pela UI do QR para prever a elegibilidade do check-in. */
export const CHECK_IN_LOOKUP_WINDOW_HOURS = 12;

export const checkInByEquipmentInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    equipmentId: uuidSchema,
  })
  .strict();

export const checkInRefusalReasons = [
  'NO_ACTIVE_RESERVATION',
  'RESERVATION_NOT_STARTED_YET',
  'RESERVATION_OF_ANOTHER_USER',
  'RESERVATION_RELEASED_ABSENCE',
  'RESERVATION_CANCELLED',
  'EQUIPMENT_BUSY_WITH_PREVIOUS',
] as const;
export const checkInRefusalReasonSchema = z.enum(checkInRefusalReasons);

/**
 * Corpo devolvido com HTTP 422 quando o check-in por equipamento é recusado.
 *
 * 422 (e nunca 409): o proxy BFF intercepta todo 409 e o valida contra
 * conflictErrorResponseSchema, transformando qualquer outro formato em 502.
 *
 * Os horários viajam como ISO puro — a formatação em pt-BR acontece no cliente,
 * no fuso do navegador.
 */
export const checkInRefusalResponseSchema = z
  .object({
    code: checkInRefusalReasonSchema,
    message: z.string().trim().min(1).max(500),
    nextReservationStartsAt: timestampSchema.nullable().default(null),
    occupiedUntil: timestampSchema.nullable().default(null),
  })
  .strict();

export type CheckInByEquipmentInput = z.infer<typeof checkInByEquipmentInputSchema>;
export type CheckInRefusalReason = z.infer<typeof checkInRefusalReasonSchema>;
export type CheckInRefusalResponse = z.infer<typeof checkInRefusalResponseSchema>;
