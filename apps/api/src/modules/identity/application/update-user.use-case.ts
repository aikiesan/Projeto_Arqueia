import type {
  AuthenticatedPrincipal,
  UpdateUserInput,
  User,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { UserWriter } from '../domain/ports/user-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class UpdateUserUseCase {
  public constructor(
    private readonly users: UserWriter,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    userId: string,
    input: UpdateUserInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<User> {
    this.permissions.assertCan(principal, 'identity.user.manage');
    return this.users.update(userId, input, { ...context, actorId: principal.user.id });
  }
}
