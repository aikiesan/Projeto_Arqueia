import type {
  AuthenticatedPrincipal,
  ReleaseAbsentReservationsInput,
  ReleaseAbsentReservationsResult,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class ReleaseAbsentReservationsUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: ReleaseAbsentReservationsInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<ReleaseAbsentReservationsResult> {
    this.permissions.assertCan(principal, 'scheduling.block.manage', input.laboratoryId);

    return this.repository.releaseAbsentReservations(input.laboratoryId, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
