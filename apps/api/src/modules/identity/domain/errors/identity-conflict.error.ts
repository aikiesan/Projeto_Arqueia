export class IdentityConflictError extends Error {
  public constructor(message = 'O recurso de identidade conflita com um registro existente.') {
    super(message);
    this.name = 'IdentityConflictError';
  }
}
