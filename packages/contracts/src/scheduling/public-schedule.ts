import { z } from 'zod';

import { timestampSchema, uuidSchema } from '../common/entity.js';

/**
 * Agenda pública — visível SEM login, em página aberta na internet.
 *
 * Por decisão do responsável pelo laboratório, o nome de quem reservou é
 * exibido. O contrato existe para que essa exposição seja explícita e
 * auditável: só o que está aqui sai para fora. Não inclua e-mail, código de
 * login, projeto, finalidade, notas nem contagem de amostras.
 */
export const PUBLIC_SCHEDULE_MAX_DAYS = 31;
export const PUBLIC_SCHEDULE_ITEM_LIMIT = 500;

export const publicScheduleQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data inicial deve ser anterior à final.',
  )
  .refine(
    (data) =>
      new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime() <=
      PUBLIC_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1_000,
    `A consulta pública não pode exceder ${PUBLIC_SCHEDULE_MAX_DAYS} dias.`,
  );

export const publicScheduleItemTypes = ['RESERVATION', 'TECHNICAL_BLOCK'] as const;
export const publicScheduleItemTypeSchema = z.enum(publicScheduleItemTypes);

export const publicScheduleItemSchema = z
  .object({
    type: publicScheduleItemTypeSchema,
    equipmentName: z.string().trim().min(1).max(200),
    equipmentCode: z.string().trim().min(1).max(48),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    inProgress: z.boolean(),
    /** Nome de quem reservou; null em bloqueios técnicos. */
    reservedBy: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export const publicLaboratorySchema = z
  .object({
    id: uuidSchema,
    code: z.string().trim().min(1).max(48),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const publicScheduleResponseSchema = z
  .object({
    laboratory: publicLaboratorySchema,
    timezone: z.string().trim().min(1).max(80),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    items: z.array(publicScheduleItemSchema).max(PUBLIC_SCHEDULE_ITEM_LIMIT),
  })
  .strict();

export const publicLaboratoryListSchema = z.array(publicLaboratorySchema).max(100);

export type PublicScheduleQuery = z.output<typeof publicScheduleQuerySchema>;
export type PublicScheduleItem = z.infer<typeof publicScheduleItemSchema>;
export type PublicLaboratory = z.infer<typeof publicLaboratorySchema>;
export type PublicScheduleResponse = z.infer<typeof publicScheduleResponseSchema>;
