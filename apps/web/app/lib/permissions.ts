import {
  LABORATORY_ROLE_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type AuthenticatedPrincipal,
  type IdentityPermission,
} from '@arqueia/contracts';

/**
 * Espelho client-safe do PermissionEvaluator do servidor, usado para
 * esconder/mostrar elementos de UI (conveniência). A decisão de acesso real é sempre
 * reavaliada no servidor (não negociável #5).
 */
export function principalCan(
  principal: AuthenticatedPrincipal,
  permission: IdentityPermission,
  laboratoryId?: string,
): boolean {
  if (principal.user.status !== 'ACTIVE' || principal.user.archivedAt !== null) return false;

  const bySystemRole = principal.systemRoles.some(
    (assignment) =>
      assignment.archivedAt === null &&
      SYSTEM_ROLE_PERMISSIONS[assignment.role].includes(permission),
  );
  if (bySystemRole) return true;

  return principal.memberships.some((membership) => {
    if (membership.archivedAt !== null) return false;
    if (laboratoryId !== undefined && membership.laboratoryId !== laboratoryId) return false;
    const rolePermissions: readonly IdentityPermission[] =
      LABORATORY_ROLE_PERMISSIONS[membership.role];
    return rolePermissions.includes(permission);
  });
}

export function isGlobalAdministrator(principal: AuthenticatedPrincipal): boolean {
  return principal.systemRoles.some(
    (assignment) => assignment.archivedAt === null && assignment.role === 'ADMIN',
  );
}
