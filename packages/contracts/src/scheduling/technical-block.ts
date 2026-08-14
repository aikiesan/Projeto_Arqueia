import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const technicalBlockReasons = [
  'MAINTENANCE',
  'CALIBRATION',
  'INTERRUPTED_SERVICE',
  'OTHER',
] as const;
export const technicalBlockReasonSchema = z.enum(technicalBlockReasons);

export const technicalBlockStatuses = ['ACTIVE', 'CANCELLED'] as const;
export const technicalBlockStatusSchema = z.enum(technicalBlockStatuses);

export const technicalBlockFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  equipmentId: uuidSchema,
  createdByUserId: uuidSchema,
  reason: technicalBlockReasonSchema,
  description: z.string().trim().min(3).max(1_000),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  status: technicalBlockStatusSchema,
  cancelledAt: timestampSchema.nullable().default(null),
  cancelledByUserId: uuidSchema.nullable().default(null),
});

export const technicalBlockSchema = entityMetadataSchema
  .extend(technicalBlockFieldsSchema.shape)
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora de início do bloqueio deve ser anterior à data/hora de término.',
  );

export const createTechnicalBlockInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    equipmentId: uuidSchema,
    reason: technicalBlockReasonSchema,
    description: z.string().trim().min(3).max(1_000),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  })
  .strict()
  .refine(
    (data) => new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    'A data/hora de início do bloqueio deve ser anterior à data/hora de término.',
  );

export const cancelTechnicalBlockInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    technicalBlockId: uuidSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const technicalBlockParamsSchema = z.object({ technicalBlockId: uuidSchema }).strict();
export const technicalBlockPageSchema = createCursorPageSchema(technicalBlockSchema).strict();

export type TechnicalBlockReason = z.infer<typeof technicalBlockReasonSchema>;
export type TechnicalBlockStatus = z.infer<typeof technicalBlockStatusSchema>;
export type TechnicalBlock = z.infer<typeof technicalBlockSchema>;
export type CreateTechnicalBlockInput = z.input<typeof createTechnicalBlockInputSchema>;
export type CancelTechnicalBlockInput = z.input<typeof cancelTechnicalBlockInputSchema>;
export type TechnicalBlockPage = z.infer<typeof technicalBlockPageSchema>;
