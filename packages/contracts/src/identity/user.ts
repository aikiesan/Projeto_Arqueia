import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';

export const userStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);
export const academicCategorySchema = z.enum([
  'IC',
  'MESTRADO',
  'DOUTORADO',
  'POS_DOUTORADO',
  'PESQUISADOR',
]);
export const loginCodeSchema = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'Use apenas letras, números e hífen.')
  .transform((value) => value.toUpperCase());

const userFieldsSchema = z.object({
  institutionId: uuidSchema,
  loginCode: loginCodeSchema,
  academicCategory: academicCategorySchema,
  status: userStatusSchema,
  mustChangePassword: z.boolean(),
});

export const userSchema = entityMetadataSchema.extend(userFieldsSchema.shape).strict();

export const createUserInputSchema = userFieldsSchema
  .pick({ institutionId: true, academicCategory: true })
  .extend({
    laboratoryId: uuidSchema,
    temporaryPassword: z.string().min(12).max(128),
  })
  .strict();

export const updateUserInputSchema = userFieldsSchema
  .pick({ academicCategory: true, status: true })
  .partial()
  .extend({ laboratoryId: uuidSchema })
  .strict();

export const userParamsSchema = z.object({ userId: uuidSchema }).strict();

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.input<typeof createUserInputSchema>;
export type UpdateUserInput = z.input<typeof updateUserInputSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type AcademicCategory = z.infer<typeof academicCategorySchema>;
