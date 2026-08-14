import type { AuthenticatedPrincipal, DashboardSummary } from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import type { ManagementRepository } from '../domain/ports/management-repository.port.js';

export class GetDashboardSummaryUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(principal: AuthenticatedPrincipal, laboratoryId: string): Promise<DashboardSummary> {
    this.permissions.assertCan(principal, 'identity.laboratory.read', laboratoryId);
    return this.repository.getDashboardSummary(laboratoryId);
  }
}
