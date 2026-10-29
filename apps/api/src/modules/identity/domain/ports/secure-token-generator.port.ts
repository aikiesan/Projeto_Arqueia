/**
 * Fonte de aleatoriedade do token de redefinição. É porta, e não `randomBytes`
 * chamado direto no caso de uso, para que o teste possa fixar o token emitido.
 */
export interface SecureTokenGenerator {
  generate(): string;
}

export const SECURE_TOKEN_GENERATOR = Symbol('SECURE_TOKEN_GENERATOR');
