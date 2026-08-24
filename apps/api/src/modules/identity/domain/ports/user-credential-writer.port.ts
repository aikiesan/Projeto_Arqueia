import type { IdentityMutationContext } from './identity-mutation-context.js';

export interface UserCredentialWriter {
  setPasswordHash(
    userId: string,
    passwordHash: string,
    context: IdentityMutationContext,
    action: 'identity.user.password_changed' | 'identity.user.password_reset_by_admin',
  ): Promise<void>;
}

export const USER_CREDENTIAL_WRITER = Symbol('USER_CREDENTIAL_WRITER');
