import type {
  AuthenticatedPrincipal,
  Membership,
  RevokeAccessRequest,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { MembershipReader, MembershipWriter } from '../domain/ports/membership-repository.port.js';
import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import type { ReauthenticationService } from '../domain/services/reauthentication.js';

export class RevokeMembershipUseCase {
  public constructor(
    private readonly membershipReader: MembershipReader,
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
    const membership = await this.membershipReader.findActiveById(membershipId);
    if (membership === null) {
      throw new IdentityEntityNotFoundError('Membership', membershipId);
    }
    this.permissions.assertCan(
      principal,
      'identity.membership.manage',
      membership.laboratoryId,
    );
    await this.reauthentication.assertPassword(principal, input.confirmationPassword);
    return this.memberships.revoke(membershipId, { ...context, actorId: principal.user.id });
  }
}
