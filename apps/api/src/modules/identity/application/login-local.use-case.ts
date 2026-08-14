import type { LocalLoginInput, LoginResponse } from '@arqueia/contracts';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import type { AccessTokenIssuer } from '../domain/ports/access-token-issuer.port.js';
import type { AuditEventWriter } from '../domain/ports/audit-event-writer.port.js';
import type { LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';

export interface LoginRequestContext {
  readonly origin: string;
  readonly requestId: string | null;
}

export class LoginLocalUseCase {
  public constructor(
    private readonly identities: LocalIdentityReader,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly tokenIssuer: AccessTokenIssuer,
    private readonly auditEvents: AuditEventWriter,
  ) {}

  public async execute(
    input: LocalLoginInput,
    context: LoginRequestContext,
  ): Promise<LoginResponse> {
    const account = await this.identities.findActiveByEmail(input.email);
    const passwordMatches = await this.passwordVerifier.verify(
      input.password,
      account?.passwordHash ?? null,
    );

    if (
      account === null ||
      !passwordMatches ||
      account.principal.user.status !== 'ACTIVE' ||
      account.principal.user.archivedAt !== null
    ) {
      throw new InvalidCredentialsError();
    }

    const token = await this.tokenIssuer.issue(account.principal);

    await this.auditEvents.append({
      actorId: account.principal.user.id,
      laboratoryId: null,
      action: 'identity.login.succeeded',
      entity: 'User',
      entityId: account.principal.user.id,
      before: null,
      after: null,
      origin: context.origin,
      requestId: context.requestId,
    });

    return {
      accessToken: token.accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: token.expiresInSeconds,
      principal: account.principal,
    };
  }
}
