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

    const isStaffOrAdmin =
      principal.systemRoles.some((sr) => sr.role === 'ADMIN') ||
      principal.memberships.some(
        (m) => m.laboratoryId === query.laboratoryId && m.role === 'TECNICO',
      );


    return this.repository.listSchedule(query, principal.user.id, isStaffOrAdmin);
  }
}
