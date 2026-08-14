import type { AuthenticatedPrincipal } from '@arqueia/contracts';

import { InvalidCredentialsError } from '../errors/invalid-credentials.error.js';
import type { LocalIdentityReader } from '../ports/local-identity-reader.port.js';
import type { PasswordVerifier } from '../ports/password-verifier.port.js';

/**
 * Reautenticação interina exigida pelo SECURITY.md para mudanças de permissão,
 * enquanto o contrato de MFA não existe. Confirma que a senha informada é a do
 * próprio ator. A senha nunca é persistida nem incluída em auditoria.
 */
export class ReauthenticationService {
  public constructor(
    private readonly identities: LocalIdentityReader,
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  public async assertPassword(
    principal: AuthenticatedPrincipal,
    password: string,
  ): Promise<void> {
    const account = await this.identities.findActiveByEmail(principal.user.email);
    const matches = await this.passwordVerifier.verify(password, account?.passwordHash ?? null);

    if (account === null || !matches) {
      throw new InvalidCredentialsError();
    }
  }
}
