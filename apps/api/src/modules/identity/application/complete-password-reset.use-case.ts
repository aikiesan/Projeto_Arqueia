import type { CompletePasswordResetInput } from '@arqueia/contracts';

import { InvalidPasswordResetTokenError } from '../domain/errors/invalid-password-reset-token.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { PasswordResetTokenConsumer } from '../domain/ports/password-reset-token-repository.port.js';
import type { UserCredentialWriter } from '../domain/ports/user-credential-writer.port.js';
import { hashPasswordResetToken } from '../domain/services/password-reset-token.js';

/**
 * Segunda metade do "esqueci minha senha": troca o token do e-mail pela nova
 * senha. O ator da auditoria é o próprio dono da conta — ninguém com sessão
 * participa deste caminho.
 */
export class CompletePasswordResetUseCase {
  public constructor(
    private readonly tokens: PasswordResetTokenConsumer,
    private readonly credentialWriter: UserCredentialWriter,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  public async execute(
    input: CompletePasswordResetInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<{ success: true }> {
    const consumed = await this.tokens.consume(hashPasswordResetToken(input.token));
    if (consumed === null) throw new InvalidPasswordResetTokenError();

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.credentialWriter.setPasswordHash(
      consumed.userId,
      newHash,
      { ...context, actorId: consumed.userId },
      'identity.user.password_reset_by_token',
    );
    return { success: true };
  }
}
