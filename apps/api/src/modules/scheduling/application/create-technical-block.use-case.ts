import type {
  AuthenticatedPrincipal,
  CreateTechnicalBlockInput,
  TechnicalBlock,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CreateTechnicalBlockUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateTechnicalBlockInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<TechnicalBlock> {
    this.permissions.assertCan(principal, 'scheduling.block.manage', input.laboratoryId);
    return this.repository.createTechnicalBlock(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
