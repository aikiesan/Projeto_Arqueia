import type {
  AuthenticatedPrincipal,
  RevokeAccessRequest,
  SystemRoleAssignment,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { SystemRoleWriter } from '../domain/ports/membership-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class RevokeSystemRoleUseCase {
  public constructor(
    private readonly systemRoles: SystemRoleWriter,
    private readonly permissions: PermissionEvaluator,
    private readonly reauthentication: ReauthenticationService,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    assignmentId: string,
    input: RevokeAccessRequest,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<SystemRoleAssignment> {
    this.permissions.assertCan(principal, 'identity.membership.manage');
    await this.reauthentication.assertPassword(principal, input.confirmationPassword);
    return this.systemRoles.revoke(assignmentId, { ...context, actorId: principal.user.id });
  }
}
