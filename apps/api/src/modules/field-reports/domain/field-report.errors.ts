export class FieldReportNotFoundError extends Error {
  public constructor(fieldReportId: string) {
    super(`Informe não encontrado: ${fieldReportId}.`);
    this.name = 'FieldReportNotFoundError';
  }
}

export class FieldReportLaboratoryNotFoundError extends Error {
  public constructor() {
    super('Laboratório não encontrado para receber informes.');
    this.name = 'FieldReportLaboratoryNotFoundError';
  }
}

/** Equipamento arquivado, inexistente ou de outro laboratório. */
export class FieldReportEquipmentMismatchError extends Error {
  public constructor() {
    super('O equipamento informado não pertence a este laboratório.');
    this.name = 'FieldReportEquipmentMismatchError';
  }
}
