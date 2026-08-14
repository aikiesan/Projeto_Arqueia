export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
