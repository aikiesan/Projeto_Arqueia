import type { AuthenticatedPrincipal, FieldReportSummary } from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { summarizeFieldReports } from '../domain/field-report-summary.js';
import type { FieldReportReviewRepository } from '../domain/ports/field-report-repository.port.js';

export class SummarizeFieldReportsUseCase {
  public constructor(
    private readonly reports: FieldReportReviewRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
  ): Promise<FieldReportSummary> {
    this.permissions.assertCan(principal, 'field-report.review', laboratoryId);
    return summarizeFieldReports(laboratoryId, await this.reports.countByKindAndStatus(laboratoryId));
  }
}
