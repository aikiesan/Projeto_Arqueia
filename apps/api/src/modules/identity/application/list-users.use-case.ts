import type { AuthenticatedPrincipal, User } from '@arqueia/contracts';

import type { UserReader } from '../domain/ports/user-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import { activeLaboratoryIds, isGlobalAdministrator } from './identity-scope.js';

export class ListUsersUseCase {
  public constructor(
    private readonly users: UserReader,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(principal: AuthenticatedPrincipal): Promise<readonly User[]> {
    if (isGlobalAdministrator(principal)) {
      this.permissions.assertCan(principal, 'identity.user.read');
      return this.users.listVisibleTo(null);
    }

    const manageableLaboratoryIds = activeLaboratoryIds(principal).filter((laboratoryId) =>
      this.permissions.can(principal, 'identity.user.read', laboratoryId),
    );

    if (manageableLaboratoryIds.length === 0) {
      this.permissions.assertCan(principal, 'identity.user.read');
    }

    return this.users.listVisibleTo(manageableLaboratoryIds);
  }
}
