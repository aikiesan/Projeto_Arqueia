import type {
  AuthenticatedPrincipal,
  Project,
  UpdateProjectInput,
} from '@arqueia/contracts';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type {
  ProjectReader,
  ProjectWriter,
} from '../domain/ports/project-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class UpdateProjectUseCase {
  public constructor(
    private readonly projectReader: ProjectReader,
    private readonly projectWriter: ProjectWriter,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    projectId: string,
    input: UpdateProjectInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Project> {
    const project = await this.projectReader.findActiveById(projectId);
    if (project === null) {
      throw new IdentityEntityNotFoundError('Project', projectId);
    }

    this.permissions.assertCan(principal, 'identity.project.manage', project.laboratoryId);
    return this.projectWriter.update(projectId, input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
