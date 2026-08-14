export class InvalidCredentialsError extends Error {
  public constructor() {
    super('E-mail ou senha inválidos.');
    this.name = 'InvalidCredentialsError';
  }
}
