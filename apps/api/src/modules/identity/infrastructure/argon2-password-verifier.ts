import { Algorithm, hash, verify } from '@node-rs/argon2';

import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export class Argon2PasswordVerifier implements PasswordVerifier {
  private readonly dummyHash = hash('arqueia-login-timing-equalizer', ARGON2_OPTIONS);

  public async verify(password: string, passwordHash: string | null): Promise<boolean> {
    const hashToVerify = passwordHash ?? (await this.dummyHash);

    try {
      return await verify(hashToVerify, password);
    } catch {
      return false;
    }
  }
}

export async function hashLocalPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export class Argon2PasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return hashLocalPassword(password);
  }
}
