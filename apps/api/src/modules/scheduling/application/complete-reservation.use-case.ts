import type {
  AuthenticatedPrincipal,
  CompleteReservationInput,
  Reservation,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CompleteReservationUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CompleteReservationInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<Reservation> {
    this.permissions.assertCan(principal, 'scheduling.reserve', input.laboratoryId);

    return this.repository.completeReservation(
      input.laboratoryId,
      input.reservationId,
      input.notes,
      {
        ...context,
        actorId: principal.user.id,
      },
      this.permissions.can(principal, 'scheduling.approve', input.laboratoryId),
    );
  }
}
