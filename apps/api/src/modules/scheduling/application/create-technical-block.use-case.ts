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
import { SchedulingStartsInPastError } from '../domain/scheduling.errors.js';

export class CreateTechnicalBlockUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateTechnicalBlockInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<TechnicalBlock> {
    this.permissions.assertCan(principal, 'scheduling.block.manage', input.laboratoryId);
    if (Date.parse(input.startsAt) < this.now().getTime()) {
      throw new SchedulingStartsInPastError();
    }
    return this.repository.createTechnicalBlock(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
