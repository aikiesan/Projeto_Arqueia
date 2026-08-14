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

export const sessionMetadataSchema = z
  .object({
    id: uuidSchema,
    deviceInfo: z.string().min(1).max(256),
    ipAddress: z.string().min(1).max(45),
    isCurrent: z.boolean(),
    createdAt: z.string().datetime(),
    lastActiveAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const listSessionsResponseSchema = z
  .object({
    sessions: z.array(sessionMetadataSchema),
  })
  .strict();

export const revokeSessionInputSchema = z
  .object({
    sessionId: uuidSchema,
  })
  .strict();

export const refreshSessionInputSchema = z
  .object({
    refreshToken: z.string().min(16).max(256),
  })
  .strict();

export const apiLoginResultSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(16),
    tokenType: z.literal('Bearer'),
    expiresInSeconds: z.number().int().positive(),
    sessionId: uuidSchema,
    principal: authenticatedPrincipalSchema,
  })
  .strict();

export const bffPublicLoginResponseSchema = z
  .object({
    expiresInSeconds: z.number().int().positive(),
    principal: authenticatedPrincipalSchema,
  })
  .strict();

export const apiRefreshResultSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(16),
    expiresInSeconds: z.number().int().positive(),
    sessionId: uuidSchema,
  })
  .strict();

export const bffPublicRefreshResponseSchema = z
  .object({
    expiresInSeconds: z.number().int().positive(),
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

export const oidcProviderMetadataSchema = z
  .object({
    enabled: z.boolean(),
    displayName: z.string().trim().min(1).max(80),
    authorizationUrl: z.string().url().nullable(),
  })
  .strict();

export type LocalLoginInput = z.input<typeof localLoginInputSchema>;
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
export type SessionMetadata = z.infer<typeof sessionMetadataSchema>;
export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;
export type RevokeSessionInput = z.infer<typeof revokeSessionInputSchema>;
export type RefreshSessionInput = z.infer<typeof refreshSessionInputSchema>;
export type ApiLoginResult = z.infer<typeof apiLoginResultSchema>;
export type BffPublicLoginResponse = z.infer<typeof bffPublicLoginResponseSchema>;
export type ApiRefreshResult = z.infer<typeof apiRefreshResultSchema>;
export type BffPublicRefreshResponse = z.infer<typeof bffPublicRefreshResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type OidcProviderMetadata = z.infer<typeof oidcProviderMetadataSchema>;
