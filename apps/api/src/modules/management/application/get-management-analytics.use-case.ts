import type {
  AuthenticatedPrincipal,
  ManagementAnalytics,
  ManagementAnalyticsQuery,
} from '@arqueia/contracts';

import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class GetManagementAnalyticsUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: ManagementAnalyticsQuery,
  ): Promise<ManagementAnalytics> {
    this.permissions.assertCan(principal, 'management.report.read', query.laboratoryId);
    return this.repository.getAnalytics(query);
  }
}
