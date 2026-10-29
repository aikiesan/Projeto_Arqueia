export class InvalidPasswordResetTokenError extends Error {
  public constructor() {
    super('Link de redefinição inválido, já usado ou expirado.');
    this.name = 'InvalidPasswordResetTokenError';
  }
}
