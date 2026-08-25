import type {
  AuthenticatedPrincipal,
  Reservation,
  StartWalkInReservationInput,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class StartWalkInReservationUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: StartWalkInReservationInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<Reservation> {
    this.permissions.assertCan(principal, 'scheduling.reserve', input.laboratoryId);

    return this.repository.startWalkInReservation(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
