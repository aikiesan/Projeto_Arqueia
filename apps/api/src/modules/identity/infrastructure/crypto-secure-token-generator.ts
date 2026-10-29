import { randomBytes } from 'node:crypto';

import type { SecureTokenGenerator } from '../domain/ports/secure-token-generator.port.js';

const TOKEN_BYTES = 32;

export class CryptoSecureTokenGenerator implements SecureTokenGenerator {
  public generate(): string {
    return randomBytes(TOKEN_BYTES).toString('hex');
  }
}
