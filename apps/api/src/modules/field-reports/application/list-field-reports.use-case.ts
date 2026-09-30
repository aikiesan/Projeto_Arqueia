import type {
  AuthenticatedPrincipal,
  FieldReportPage,
  ListFieldReportsQuery,
} from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import type { FieldReportReviewRepository } from '../domain/ports/field-report-repository.port.js';

export class ListFieldReportsUseCase {
  public constructor(
    private readonly reports: FieldReportReviewRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    query: ListFieldReportsQuery,
  ): Promise<FieldReportPage> {
    this.permissions.assertCan(principal, 'field-report.review', query.laboratoryId);
    return this.reports.list(query);
  }
}
