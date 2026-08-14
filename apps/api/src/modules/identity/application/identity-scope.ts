import type { AuthenticatedPrincipal } from '@arqueia/contracts';

export function isGlobalAdministrator(principal: AuthenticatedPrincipal): boolean {
  return principal.systemRoles.some(
    (assignment) => assignment.role === 'ADMIN' && assignment.archivedAt === null,
  );
}

export function activeLaboratoryIds(principal: AuthenticatedPrincipal): readonly string[] {
  return [
    ...new Set(
      principal.memberships
        .filter((membership) => membership.archivedAt === null)
        .map((membership) => membership.laboratoryId),
    ),
  ];
}
