import type {
  AuthenticatedPrincipal,
  CreateProjectInput,
  Project,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { ProjectWriter } from '../domain/ports/project-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class CreateProjectUseCase {
  public constructor(
    private readonly projects: ProjectWriter,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateProjectInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Project> {
    this.permissions.assertCan(principal, 'identity.project.manage', input.laboratoryId);
    return this.projects.create(input, { ...context, actorId: principal.user.id });
  }
}
