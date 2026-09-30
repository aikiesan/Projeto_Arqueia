import type {
  FieldReport,
  FieldReportKind,
  FieldReportPage,
  FieldReportStatus,
  ListFieldReportsQuery,
  ParsedReviewFieldReportInput,
  ParsedSubmitFieldReportInput,
  PublicFieldReportForm,
} from '@arqueia/contracts';

export interface FieldReportRequestContext {
  readonly origin: string;
  readonly requestId: string | null;
}

export interface FieldReportReviewContext extends FieldReportRequestContext {
  readonly actorId: string;
}

export interface SubmittedFieldReport {
  readonly id: string;
  readonly createdAt: string;
}

/** Uma linha da contagem agregada que alimenta o compilado. */
export interface FieldReportCountRow {
  readonly kind: FieldReportKind;
  readonly status: FieldReportStatus;
  readonly blocksUse: boolean;
  readonly count: number;
}

/**
 * Porta do lado público (sem login). Separada da porta de revisão para que o
 * caminho aberto à internet não tenha, nem por acidente, como ler informes.
 */
export interface PublicFieldReportGateway {
  /** null quando o laboratório não existe ou está arquivado. */
  findPublicForm(laboratoryId: string): Promise<PublicFieldReportForm | null>;
  /**
   * Grava o informe e a auditoria na mesma transação. Recusa laboratório
   * inexistente e equipamento que não seja ativo do mesmo laboratório.
   */
  submit(
    input: ParsedSubmitFieldReportInput,
    context: FieldReportRequestContext,
  ): Promise<SubmittedFieldReport>;
}

/** Porta da coordenação: leitura e triagem. */
export interface FieldReportReviewRepository {
  list(query: ListFieldReportsQuery): Promise<FieldReportPage>;
  countByKindAndStatus(laboratoryId: string): Promise<readonly FieldReportCountRow[]>;
  findActiveById(fieldReportId: string): Promise<FieldReport | null>;
  review(
    fieldReportId: string,
    input: ParsedReviewFieldReportInput,
    context: FieldReportReviewContext,
  ): Promise<FieldReport>;
}

export const PUBLIC_FIELD_REPORT_GATEWAY = Symbol('PUBLIC_FIELD_REPORT_GATEWAY');
export const FIELD_REPORT_REVIEW_REPOSITORY = Symbol('FIELD_REPORT_REVIEW_REPOSITORY');
