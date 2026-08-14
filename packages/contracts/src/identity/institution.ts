import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';

const institutionFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  acronym: z.string().trim().min(2).max(24).transform((value) => value.toUpperCase()),
});

export const institutionSchema = entityMetadataSchema.extend(institutionFieldsSchema.shape);
export const createInstitutionInputSchema = institutionFieldsSchema.strict();
export const updateInstitutionInputSchema = institutionFieldsSchema.partial().strict();
export const institutionParamsSchema = z.object({ institutionId: uuidSchema }).strict();

export type Institution = z.infer<typeof institutionSchema>;
export type CreateInstitutionInput = z.input<typeof createInstitutionInputSchema>;
export type UpdateInstitutionInput = z.input<typeof updateInstitutionInputSchema>;
