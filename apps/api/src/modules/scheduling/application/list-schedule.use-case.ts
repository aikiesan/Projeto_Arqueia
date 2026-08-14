import type {
  AuthenticatedPrincipal,
  ListScheduleQuery,
  ScheduleResponse,
} from '@arqueia/contracts';

import type { SchedulingRepository } from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class ListScheduleUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: ListScheduleQuery,
  ): Promise<ScheduleResponse> {
    this.permissions.assertCan(principal, 'equipment.read', query.laboratoryId);

    const canManageReservations = this.permissions.can(
      principal,
      'scheduling.approve',
      query.laboratoryId,
    );

    return this.repository.listSchedule(query, principal.user.id, {
      canCancelOwn: this.permissions.can(principal, 'scheduling.cancel', query.laboratoryId),
      canManageBlocks: this.permissions.can(
        principal,
        'scheduling.block.manage',
        query.laboratoryId,
      ),
      canManageReservations,
      canReserve: this.permissions.can(principal, 'scheduling.reserve', query.laboratoryId),
      canViewPrivateReservations: canManageReservations,
    });
  }
}
