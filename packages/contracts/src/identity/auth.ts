import { z } from 'zod';

import { uuidSchema } from '../common/entity.js';
import { membershipSchema, systemRoleAssignmentSchema } from './membership.js';
import { institutionalEmailSchema, userSchema } from './user.js';

export const localLoginInputSchema = z
  .object({
    email: institutionalEmailSchema,
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

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict()
  .refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
    message: 'A nova senha deve ser diferente da senha atual.',
    path: ['newPassword'],
  });

export const resetUserPasswordInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    newPassword: z.string().min(12).max(128),
    confirmationPassword: z.string().min(1).max(128),
  })
  .strict();

/**
 * Autoatendimento de "esqueci minha senha".
 *
 * O token é o segredo entregue por e-mail: 32 bytes aleatórios em hexadecimal.
 * O banco guarda só o SHA-256 dele, então quem lê a tabela não consegue
 * redefinir a senha de ninguém.
 */
export const passwordResetTokenSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/, 'Token de redefinição inválido.');

export const requestPasswordResetInputSchema = z
  .object({
    email: institutionalEmailSchema,
  })
  .strict();

/**
 * A resposta do pedido é sempre a mesma, exista a conta ou não: dizer "esse
 * e-mail não está cadastrado" transformaria o formulário em um verificador de
 * quem tem conta no Arqueia.
 */
export const requestPasswordResetResponseSchema = z
  .object({
    acknowledged: z.literal(true),
  })
  .strict();

export const completePasswordResetInputSchema = z
  .object({
    token: passwordResetTokenSchema,
    newPassword: z.string().min(12).max(128),
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
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordInputSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetInputSchema>;
export type RequestPasswordResetResponse = z.infer<typeof requestPasswordResetResponseSchema>;
export type CompletePasswordResetInput = z.infer<typeof completePasswordResetInputSchema>;
