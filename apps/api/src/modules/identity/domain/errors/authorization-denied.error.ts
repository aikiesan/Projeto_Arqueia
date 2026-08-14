export class AuthorizationDeniedError extends Error {
  public constructor() {
    super('O usuário não possui permissão para executar esta ação no laboratório informado.');
    this.name = 'AuthorizationDeniedError';
  }
}
