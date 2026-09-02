import type { AuthenticatedPrincipal, ChangePasswordInput } from '@arqueia/contracts';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import type { CurrentCredentialReader } from '../domain/ports/current-credential-reader.port.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import type { UserCredentialWriter } from '../domain/ports/user-credential-writer.port.js';

export class ChangePasswordUseCase {
  public constructor(
    private readonly credentials: CurrentCredentialReader,
    private readonly credentialWriter: UserCredentialWriter,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    input: ChangePasswordInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<{ success: true }> {
    const credential = await this.credentials.findActiveByUserId(principal.user.id);
    const isValid = await this.passwordVerifier.verify(
      input.currentPassword,
      credential?.passwordHash ?? null,
    );
    if (credential === null || !isValid) throw new InvalidCredentialsError();

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.credentialWriter.setPasswordHash(
      principal.user.id,
      newHash,
      { ...context, actorId: principal.user.id },
      'identity.user.password_changed',
    );
    return { success: true };
  }
}
