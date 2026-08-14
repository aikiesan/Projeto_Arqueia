import type {
  AuthenticatedPrincipal,
  Membership,
  RevokeAccessRequest,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { MembershipWriter } from '../domain/ports/membership-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class RevokeMembershipUseCase {
  public constructor(
    private readonly memberships: MembershipWriter,
    private readonly permissions: PermissionEvaluator,
    private readonly reauthentication: ReauthenticationService,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    membershipId: string,
    input: RevokeAccessRequest,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Membership> {
    this.permissions.assertCan(principal, 'identity.membership.manage');
    await this.reauthentication.assertPassword(principal, input.confirmationPassword);
    return this.memberships.revoke(membershipId, { ...context, actorId: principal.user.id });
  }
}
