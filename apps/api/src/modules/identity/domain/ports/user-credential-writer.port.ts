import type { IdentityMutationContext } from './identity-mutation-context.js';

/**
 * Quem trocou a senha, e por qual caminho. Vira a ação da auditoria e decide
 * se a conta fica marcada para trocar a senha no próximo login: só a redefinição
 * feita por um administrador deixa uma senha que o dono da conta não escolheu.
 */
export type UserCredentialWriteAction =
  | 'identity.user.password_changed'
  | 'identity.user.password_reset_by_admin'
  | 'identity.user.password_reset_by_token';

export interface UserCredentialWriter {
  setPasswordHash(
    userId: string,
    passwordHash: string,
    context: IdentityMutationContext,
    action: UserCredentialWriteAction,
  ): Promise<void>;
}

export const USER_CREDENTIAL_WRITER = Symbol('USER_CREDENTIAL_WRITER');
