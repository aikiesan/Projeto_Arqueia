import type { PublicFieldReportForm } from '@arqueia/contracts';

import { FieldReportLaboratoryNotFoundError } from '../domain/field-report.errors.js';
import type { PublicFieldReportGateway } from '../domain/ports/field-report-repository.port.js';

/** Monta o formulário público: laboratório e equipamentos ativos, sem login. */
export class GetPublicFieldReportFormUseCase {
  public constructor(private readonly gateway: PublicFieldReportGateway) {}

  public async execute(laboratoryId: string): Promise<PublicFieldReportForm> {
    const form = await this.gateway.findPublicForm(laboratoryId);
    if (form === null) throw new FieldReportLaboratoryNotFoundError();
    return form;
  }
}
