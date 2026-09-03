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
export const institutionalEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase())
  .refine((value) => /@(?:[a-z0-9-]+\.)*unicamp\.br$/.test(value), {
    message: 'Use um e-mail institucional da Unicamp.',
  });

const userFieldsSchema = z.object({
  institutionId: uuidSchema,
  loginCode: loginCodeSchema,
  name: z.string().trim().min(2).max(120),
  email: institutionalEmailSchema,
  academicCategory: academicCategorySchema,
  status: userStatusSchema,
  mustChangePassword: z.boolean(),
});

export const userSchema = entityMetadataSchema.extend(userFieldsSchema.shape).strict();

export const createUserInputSchema = userFieldsSchema
  .pick({ institutionId: true, name: true, email: true, academicCategory: true })
  .extend({
    laboratoryId: uuidSchema,
    temporaryPassword: z.string().min(12).max(128),
  })
  .strict();

export const updateUserInputSchema = userFieldsSchema
  .pick({ name: true, email: true, academicCategory: true, status: true })
  .partial()
  .extend({ laboratoryId: uuidSchema })
  .strict();

export const userParamsSchema = z.object({ userId: uuidSchema }).strict();

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.input<typeof createUserInputSchema>;
export type UpdateUserInput = z.input<typeof updateUserInputSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type AcademicCategory = z.infer<typeof academicCategorySchema>;
export type InstitutionalEmail = z.infer<typeof institutionalEmailSchema>;
