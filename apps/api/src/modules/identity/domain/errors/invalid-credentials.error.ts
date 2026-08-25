export class InvalidCredentialsError extends Error {
  public constructor(message: string = 'E-mail ou senha inválidos.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}
