import {
  LABORATORY_ROLE_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type AuthenticatedPrincipal,
  type IdentityPermission,
} from '@arqueia/contracts';

import { AuthorizationDeniedError } from '../errors/authorization-denied.error.js';

export class PermissionEvaluator {
  public can(
    principal: AuthenticatedPrincipal,
    permission: IdentityPermission,
    laboratoryId?: string,
  ): boolean {
    if (principal.user.status !== 'ACTIVE' || principal.user.archivedAt !== null) {
      return false;
    }

    const hasSystemPermission = principal.systemRoles.some(
      (assignment) =>
        assignment.archivedAt === null && SYSTEM_ROLE_PERMISSIONS[assignment.role].includes(permission),
    );

    if (hasSystemPermission) {
      return true;
    }

    if (laboratoryId === undefined) {
      return false;
    }

    return principal.memberships.some(
      (membership) => {
        const rolePermissions: readonly IdentityPermission[] =
          LABORATORY_ROLE_PERMISSIONS[membership.role];

        return (
          membership.archivedAt === null &&
          membership.laboratoryId === laboratoryId &&
          rolePermissions.includes(permission)
        );
      },
    );
  }

  public assertCan(
    principal: AuthenticatedPrincipal,
    permission: IdentityPermission,
    laboratoryId?: string,
  ): void {
    if (!this.can(principal, permission, laboratoryId)) {
      throw new AuthorizationDeniedError();
    }
  }
}
