import type { AuthenticatedPrincipal, Project } from '@arqueia/contracts';

import type { ProjectReader } from '../domain/ports/project-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import { activeLaboratoryIds, isGlobalAdministrator } from './identity-scope.js';

export class ListProjectsUseCase {
  public constructor(
    private readonly projects: ProjectReader,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(principal: AuthenticatedPrincipal): Promise<readonly Project[]> {
    if (isGlobalAdministrator(principal)) {
      this.permissions.assertCan(principal, 'identity.project.read');
      return this.projects.listVisibleTo(null);
    }

    const laboratoryIds = activeLaboratoryIds(principal).filter((laboratoryId) =>
      this.permissions.can(principal, 'identity.project.read', laboratoryId),
    );
    return this.projects.listVisibleTo(laboratoryIds);
  }
}
