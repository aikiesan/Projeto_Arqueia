import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';
import { laboratoryRoleSchema, systemRoleSchema } from './roles.js';

const membershipFieldsSchema = z.object({
  userId: uuidSchema,
  laboratoryId: uuidSchema,
  role: laboratoryRoleSchema,
});

export const membershipSchema = entityMetadataSchema.extend(membershipFieldsSchema.shape).strict();
export const createMembershipInputSchema = membershipFieldsSchema.strict();
export const membershipParamsSchema = z.object({ membershipId: uuidSchema }).strict();

const systemRoleAssignmentFieldsSchema = z.object({
  userId: uuidSchema,
  role: systemRoleSchema,
});

export const systemRoleAssignmentSchema = entityMetadataSchema
  .extend(systemRoleAssignmentFieldsSchema.shape)
  .strict();
export const createSystemRoleAssignmentInputSchema = systemRoleAssignmentFieldsSchema.strict();
export const systemRoleAssignmentParamsSchema = z.object({ assignmentId: uuidSchema }).strict();

/**
 * Reautenticação interina exigida pelo SECURITY.md para mudanças de permissão,
 * até que o contrato de MFA exista. A senha é verificada no servidor e nunca
 * persistida nem auditada.
 */
export const confirmationPasswordSchema = z.string().min(1).max(128);

export const assignMembershipRequestSchema = membershipFieldsSchema
  .extend({ confirmationPassword: confirmationPasswordSchema })
  .strict();

export const assignSystemRoleRequestSchema = systemRoleAssignmentFieldsSchema
  .extend({ confirmationPassword: confirmationPasswordSchema })
  .strict();

export const revokeAccessRequestSchema = z
  .object({ confirmationPassword: confirmationPasswordSchema })
  .strict();

export const userAccessQuerySchema = z.object({ userId: uuidSchema }).strict();
export const userAccessSnapshotSchema = z
  .object({
    memberships: z.array(membershipSchema),
    systemRoles: z.array(systemRoleAssignmentSchema),
  })
  .strict();

export type Membership = z.infer<typeof membershipSchema>;
export type CreateMembershipInput = z.input<typeof createMembershipInputSchema>;
export type SystemRoleAssignment = z.infer<typeof systemRoleAssignmentSchema>;
export type CreateSystemRoleAssignmentInput = z.input<
  typeof createSystemRoleAssignmentInputSchema
>;
export type AssignMembershipRequest = z.input<typeof assignMembershipRequestSchema>;
export type AssignSystemRoleRequest = z.input<typeof assignSystemRoleRequestSchema>;
export type RevokeAccessRequest = z.input<typeof revokeAccessRequestSchema>;
export type UserAccessQuery = z.input<typeof userAccessQuerySchema>;
export type UserAccessSnapshot = z.infer<typeof userAccessSnapshotSchema>;
