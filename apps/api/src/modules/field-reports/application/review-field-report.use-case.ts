import type {
  AuthenticatedPrincipal,
  FieldReport,
  ParsedReviewFieldReportInput,
} from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { FieldReportNotFoundError } from '../domain/field-report.errors.js';
import type {
  FieldReportRequestContext,
  FieldReportReviewRepository,
} from '../domain/ports/field-report-repository.port.js';

/**
 * Triagem de um informe pela coordenação: muda o status e, se quiser, anota.
 *
 * O laboratório vem do próprio informe, não do cliente: o caso de uso busca o
 * informe primeiro e só então autoriza (papel × laboratório, AGENTS.md §4.5).
 */
export class ReviewFieldReportUseCase {
  public constructor(
    private readonly reports: FieldReportReviewRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    fieldReportId: string,
    input: ParsedReviewFieldReportInput,
    context: FieldReportRequestContext,
  ): Promise<FieldReport> {
    const current = await this.reports.findActiveById(fieldReportId);
    if (current === null) throw new FieldReportNotFoundError(fieldReportId);

    this.permissions.assertCan(principal, 'field-report.review', current.laboratoryId);
    return this.reports.review(fieldReportId, input, { ...context, actorId: principal.user.id });
  }
}
