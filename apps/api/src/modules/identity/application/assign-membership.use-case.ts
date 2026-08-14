import type {
  AssignMembershipRequest,
  AuthenticatedPrincipal,
  Membership,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { MembershipWriter } from '../domain/ports/membership-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class AssignMembershipUseCase {
  public constructor(
    private readonly memberships: MembershipWriter,
    private readonly permissions: PermissionEvaluator,
    private readonly reauthentication: ReauthenticationService,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    input: AssignMembershipRequest,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Membership> {
    this.permissions.assertCan(principal, 'identity.membership.manage');
    const { confirmationPassword, ...membership } = input;
    await this.reauthentication.assertPassword(principal, confirmationPassword);
    return this.memberships.assign(membership, { ...context, actorId: principal.user.id });
  }
}
