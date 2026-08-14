import type {
  AuditLogPage,
  AuthenticatedPrincipal,
  ListAuditLogsQuery,
} from '@arqueia/contracts';

import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class ListAuditLogsUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: ListAuditLogsQuery,
  ): Promise<AuditLogPage> {
    this.permissions.assertCan(principal, 'audit.read', query.laboratoryId);
    return this.repository.listAuditLogs(query);
  }
}
