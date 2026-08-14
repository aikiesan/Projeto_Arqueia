import type {
  AuthenticatedPrincipal,
  CreateReservationInput,
  CreateReservationResult,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CreateReservationUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateReservationInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<CreateReservationResult> {
    this.permissions.assertCan(principal, 'scheduling.reserve', input.laboratoryId);
    return this.repository.createReservation(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
