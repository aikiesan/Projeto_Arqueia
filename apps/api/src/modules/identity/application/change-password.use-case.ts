import type { AuthenticatedPrincipal, ChangePasswordInput } from '@arqueia/contracts';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import type { UserWriter } from '../domain/ports/user-repository.port.js';

export class ChangePasswordUseCase {
  public constructor(
    private readonly localIdentities: LocalIdentityReader,
    private readonly users: UserWriter,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    input: ChangePasswordInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<{ success: boolean }> {
    const account = await this.localIdentities.findActiveById(principal.user.id);
    if (account === null) {
      throw new InvalidCredentialsError('Conta local não encontrada.');
    }

    const isValid = await this.passwordVerifier.verify(
      input.currentPassword,
      account.passwordHash,
    );
    if (!isValid) {
      throw new InvalidCredentialsError('Senha atual incorreta.');
    }

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.users.setPasswordHash(
      principal.user.id,
      newHash,
      { ...context, actorId: principal.user.id },
      'identity.user.password_changed',
    );

    return { success: true };
  }
}
