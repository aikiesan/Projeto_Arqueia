import { z } from 'zod';

import { uuidSchema } from '../common/entity.js';
import { membershipSchema, systemRoleAssignmentSchema } from './membership.js';
import { userSchema } from './user.js';

export const localLoginInputSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();

export const authenticatedPrincipalSchema = z
  .object({
    user: userSchema,
    memberships: z.array(membershipSchema),
    systemRoles: z.array(systemRoleAssignmentSchema),
  })
  .strict();

export const loginResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresInSeconds: z.number().int().positive(),
    principal: authenticatedPrincipalSchema,
  })
  .strict();

export const refreshSessionInputSchema = z.object({ sessionId: uuidSchema }).strict();

export const oidcProviderMetadataSchema = z
  .object({
    enabled: z.boolean(),
    displayName: z.string().trim().min(1).max(80),
    authorizationUrl: z.string().url().nullable(),
  })
  .strict();

export type LocalLoginInput = z.input<typeof localLoginInputSchema>;
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type OidcProviderMetadata = z.infer<typeof oidcProviderMetadataSchema>;
