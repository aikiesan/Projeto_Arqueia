import type {
  CreateMembershipInput,
  CreateSystemRoleAssignmentInput,
  Membership,
  SystemRoleAssignment,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from './identity-mutation-context.js';

/**
 * Portas segregadas (ISP) para atribuição de acesso. Revogar é sempre
 * arquivamento (soft-delete), nunca DELETE — não negociável #6.
 */
export interface MembershipWriter {
  assign(input: CreateMembershipInput, context: IdentityMutationContext): Promise<Membership>;
  revoke(membershipId: string, context: IdentityMutationContext): Promise<Membership>;
}

export interface MembershipReader {
  listActiveByUser(userId: string): Promise<readonly Membership[]>;
}

export interface SystemRoleWriter {
  assign(
    input: CreateSystemRoleAssignmentInput,
    context: IdentityMutationContext,
  ): Promise<SystemRoleAssignment>;
  revoke(assignmentId: string, context: IdentityMutationContext): Promise<SystemRoleAssignment>;
}

export interface SystemRoleReader {
  listActiveByUser(userId: string): Promise<readonly SystemRoleAssignment[]>;
}

export const MEMBERSHIP_WRITER = Symbol('MEMBERSHIP_WRITER');
export const SYSTEM_ROLE_WRITER = Symbol('SYSTEM_ROLE_WRITER');
export const MEMBERSHIP_READER = Symbol('MEMBERSHIP_READER');
export const SYSTEM_ROLE_READER = Symbol('SYSTEM_ROLE_READER');
