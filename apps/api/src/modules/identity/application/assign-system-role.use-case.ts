import type {
  AssignSystemRoleRequest,
  AuthenticatedPrincipal,
  SystemRoleAssignment,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { SystemRoleWriter } from '../domain/ports/membership-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class AssignSystemRoleUseCase {
  public constructor(
    private readonly systemRoles: SystemRoleWriter,
    private readonly permissions: PermissionEvaluator,
    private readonly reauthentication: ReauthenticationService,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    input: AssignSystemRoleRequest,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<SystemRoleAssignment> {
    this.permissions.assertCan(principal, 'identity.membership.manage');
    const { confirmationPassword, ...assignment } = input;
    await this.reauthentication.assertPassword(principal, confirmationPassword);
    return this.systemRoles.assign(assignment, { ...context, actorId: principal.user.id });
  }
}
