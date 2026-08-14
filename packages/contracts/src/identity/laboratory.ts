import { z } from 'zod';

import { canonicalizeArqueiaCode } from '../common/canonical-code.js';
import { entityMetadataSchema, uuidSchema } from '../common/entity.js';

const laboratoryFieldsSchema = z.object({
  institutionId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .transform(canonicalizeArqueiaCode),
  timezone: z.string().trim().min(3).max(64).default('America/Sao_Paulo'),
});

export const laboratorySchema = entityMetadataSchema.extend(laboratoryFieldsSchema.shape);
export const createLaboratoryInputSchema = laboratoryFieldsSchema.strict();
export const updateLaboratoryInputSchema = laboratoryFieldsSchema
  .omit({ institutionId: true })
  .partial()
  .strict();
export const laboratoryParamsSchema = z.object({ laboratoryId: uuidSchema }).strict();

export type Laboratory = z.infer<typeof laboratorySchema>;
export type CreateLaboratoryInput = z.input<typeof createLaboratoryInputSchema>;
export type UpdateLaboratoryInput = z.input<typeof updateLaboratoryInputSchema>;
