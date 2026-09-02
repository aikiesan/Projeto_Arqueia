import type { AuthenticatedPrincipal, ResetUserPasswordInput } from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { UserCredentialWriter } from '../domain/ports/user-credential-writer.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class ResetUserPasswordUseCase {
  public constructor(
    private readonly credentialWriter: UserCredentialWriter,
    private readonly permissions: PermissionEvaluator,
    private readonly reauthentication: ReauthenticationService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    targetUserId: string,
    input: ResetUserPasswordInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<{ success: true }> {
    this.permissions.assertCan(principal, 'identity.user.manage', input.laboratoryId);
    await this.reauthentication.assertPassword(principal, input.confirmationPassword);

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.credentialWriter.setPasswordHash(
      targetUserId,
      newHash,
      { ...context, actorId: principal.user.id },
      'identity.user.password_reset_by_admin',
    );
    return { success: true };
  }
}
