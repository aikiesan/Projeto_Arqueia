import { z } from 'zod';

import { canonicalizeArqueiaCode } from '../common/canonical-code.js';
import { entityMetadataSchema, uuidSchema } from '../common/entity.js';

export const projectStatusSchema = z.enum(['ACTIVE', 'COMPLETED']);

const projectFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  code: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/)
    .transform(canonicalizeArqueiaCode),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).nullable(),
  status: projectStatusSchema,
});

export const projectSchema = entityMetadataSchema.extend(projectFieldsSchema.shape).strict();
export const createProjectInputSchema = projectFieldsSchema
  .omit({ status: true })
  .extend({ description: z.string().trim().max(2_000).nullable().optional().default(null) })
  .strict();
export const updateProjectInputSchema = projectFieldsSchema
  .omit({ laboratoryId: true })
  .partial()
  .strict();
export const projectParamsSchema = z.object({ projectId: uuidSchema }).strict();

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectInputSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
