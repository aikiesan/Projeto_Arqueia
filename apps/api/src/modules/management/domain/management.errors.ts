export class AuditEventNotFoundError extends Error {
  public constructor(public readonly auditEventId: string) {
    super(`Registro de auditoria ${auditEventId} não foi encontrado.`);
    this.name = 'AuditEventNotFoundError';
  }
}

export class InvalidPeriodError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidPeriodError';
  }
}
