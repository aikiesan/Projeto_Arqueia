import type { AuthenticatedPrincipal, UserAccessSnapshot } from '@arqueia/contracts';

import type {
  MembershipReader,
  SystemRoleReader,
} from '../domain/ports/membership-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class GetUserAccessUseCase {
  public constructor(
    private readonly memberships: MembershipReader,
    private readonly systemRoles: SystemRoleReader,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    userId: string,
  ): Promise<UserAccessSnapshot> {
    this.permissions.assertCan(principal, 'identity.membership.manage');
    const [memberships, systemRoles] = await Promise.all([
      this.memberships.listActiveByUser(userId),
      this.systemRoles.listActiveByUser(userId),
    ]);
    return { memberships: [...memberships], systemRoles: [...systemRoles] };
  }
}
