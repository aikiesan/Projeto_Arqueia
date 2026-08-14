import type { AuthenticatedPrincipal, CreateUserInput, User } from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { UserWriter } from '../domain/ports/user-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class CreateUserUseCase {
  public constructor(
    private readonly users: UserWriter,
    private readonly passwords: PasswordHasher,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    input: CreateUserInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<User> {
    this.permissions.assertCan(principal, 'identity.user.manage');
    const { temporaryPassword, ...userInput } = input;
    const passwordHash =
      temporaryPassword === undefined ? null : await this.passwords.hash(temporaryPassword);

    return this.users.create(userInput, passwordHash, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
