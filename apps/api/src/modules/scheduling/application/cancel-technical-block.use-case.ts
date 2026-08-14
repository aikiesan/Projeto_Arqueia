import type { AuthenticatedPrincipal, TechnicalBlock } from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CancelTechnicalBlockUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
    technicalBlockId: string,
    reason: string | undefined,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<TechnicalBlock> {
    this.permissions.assertCan(principal, 'scheduling.block.manage', laboratoryId);
    return this.repository.cancelTechnicalBlock(technicalBlockId, reason, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
