import type {
  AuthenticatedPrincipal,
  ProjectUsagePage,
  ProjectUsageQuery,
} from '@arqueia/contracts';

import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class GetProjectUsageUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: ProjectUsageQuery,
  ): Promise<ProjectUsagePage> {
    this.permissions.assertCan(principal, 'management.report.read', query.laboratoryId);
    return this.repository.getProjectUsage(query);
  }
}
