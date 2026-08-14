import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';

export const userStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);
export const identityProviderSchema = z.enum(['LOCAL', 'OIDC', 'HYBRID']);

const userFieldsSchema = z.object({
  institutionId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  supervisorUserId: uuidSchema.nullable(),
  status: userStatusSchema,
  identityProvider: identityProviderSchema,
});

export const userSchema = entityMetadataSchema.extend(userFieldsSchema.shape).strict();

export const createUserInputSchema = userFieldsSchema
  .pick({ institutionId: true, name: true, email: true, supervisorUserId: true })
  .extend({
    supervisorUserId: uuidSchema.nullable().optional().default(null),
    temporaryPassword: z.string().min(12).max(128).optional(),
  })
  .strict();

export const updateUserInputSchema = userFieldsSchema
  .pick({ name: true, email: true, supervisorUserId: true, status: true })
  .partial()
  .strict();

export const userParamsSchema = z.object({ userId: uuidSchema }).strict();

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.input<typeof createUserInputSchema>;
export type UpdateUserInput = z.input<typeof updateUserInputSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type IdentityProvider = z.infer<typeof identityProviderSchema>;
