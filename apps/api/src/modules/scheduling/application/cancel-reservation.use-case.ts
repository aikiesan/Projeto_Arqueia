import type { AuthenticatedPrincipal, Reservation } from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CancelReservationUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
    reservationId: string,
    reason: string | undefined,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<Reservation> {
    this.permissions.assertCan(principal, 'scheduling.cancel', laboratoryId);

    const isStaffOrAdmin =
      principal.systemRoles.some((sr) => sr.role === 'ADMIN') ||
      principal.memberships.some(
        (m) => m.laboratoryId === laboratoryId && m.role === 'TECNICO',
      );


    return this.repository.cancelReservation(
      reservationId,
      reason,
      {
        ...context,
        actorId: principal.user.id,
      },
      isStaffOrAdmin,
    );
  }
}
