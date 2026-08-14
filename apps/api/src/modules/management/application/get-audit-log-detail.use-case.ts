import type {
  AuditLogDetail,
  AuthenticatedPrincipal,
} from '@arqueia/contracts';

import { AuditEventNotFoundError } from '../domain/management.errors.js';
import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class GetAuditLogDetailUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail> {
    this.permissions.assertCan(principal, 'audit.read', laboratoryId);
    const detail = await this.repository.getAuditLogDetail(auditEventId, laboratoryId);
    if (!detail) {
      throw new AuditEventNotFoundError(auditEventId);
    }
    return detail;
  }
}
