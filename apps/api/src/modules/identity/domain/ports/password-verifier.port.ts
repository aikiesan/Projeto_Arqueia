export interface PasswordVerifier {
  verify(password: string, passwordHash: string | null): Promise<boolean>;
}

export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');
