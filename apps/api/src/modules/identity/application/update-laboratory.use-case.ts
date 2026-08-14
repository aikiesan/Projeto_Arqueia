import type {
  AuthenticatedPrincipal,
  Laboratory,
  UpdateLaboratoryInput,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { LaboratoryWriter } from '../domain/ports/laboratory-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

export class UpdateLaboratoryUseCase {
  public constructor(
    private readonly laboratories: LaboratoryWriter,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
    input: UpdateLaboratoryInput,
    context: Omit<IdentityMutationContext, 'actorId'>,
  ): Promise<Laboratory> {
    this.permissions.assertCan(principal, 'identity.laboratory.manage');
    return this.laboratories.update(laboratoryId, input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
