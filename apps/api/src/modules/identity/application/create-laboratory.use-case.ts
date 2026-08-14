import type {
  AuthenticatedPrincipal,
  CreateLaboratoryInput,
  Laboratory,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { LaboratoryWriter } from '../domain/ports/laboratory-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class CreateLaboratoryUseCase {
  public constructor(
    private readonly laboratories: LaboratoryWriter,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateLaboratoryInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Laboratory> {
    this.permissions.assertCan(principal, 'identity.laboratory.manage');
    return this.laboratories.create(input, { ...context, actorId: principal.user.id });
  }
}
