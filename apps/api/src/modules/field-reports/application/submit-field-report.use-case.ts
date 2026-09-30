import {
  fieldReportReference,
  type ParsedSubmitFieldReportInput,
  type SubmitFieldReportResult,
} from '@arqueia/contracts';

import type {
  FieldReportRequestContext,
  PublicFieldReportGateway,
} from '../domain/ports/field-report-repository.port.js';

/**
 * Recebe um informe enviado pela etiqueta QR, sem login.
 *
 * Não há principal para autorizar: o formulário é aberto por decisão do
 * laboratório. Quem protege a porta é o limite de envios por origem (guard) e
 * o contrato, que só aceita os campos do formulário. A resposta devolve apenas
 * o protocolo — quem enviou não lê o informe de volta.
 */
export class SubmitFieldReportUseCase {
  public constructor(private readonly gateway: PublicFieldReportGateway) {}

  public async execute(
    input: ParsedSubmitFieldReportInput,
    context: FieldReportRequestContext,
  ): Promise<SubmitFieldReportResult> {
    const submitted = await this.gateway.submit(input, context);
    return { reference: fieldReportReference(submitted.id), receivedAt: submitted.createdAt };
  }
}
