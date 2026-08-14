import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import type { AccessTokenIssuer } from '../domain/ports/access-token-issuer.port.js';
import type { AuditEventWriter } from '../domain/ports/audit-event-writer.port.js';
import type { LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import { LoginLocalUseCase } from './login-local.use-case.js';

const now = '2026-08-14T00:00:00.000Z';
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const principal: AuthenticatedPrincipal = {
  user: {
    id: userId,
    institutionId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    name: 'Admin',
    email: 'admin@unicamp.br',
    supervisorUserId: null,
    status: 'ACTIVE',
    identityProvider: 'LOCAL',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
  memberships: [],
  systemRoles: [],
};

describe('LoginLocalUseCase', () => {
  it('issues a token and appends audit after a valid login', async () => {
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue({ principal, passwordHash: 'hash' }),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(true) };
    const tokens: AccessTokenIssuer = {
      issue: vi.fn().mockResolvedValue({ accessToken: 'token', expiresInSeconds: 900 }),
    };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit);

    const response = await useCase.execute(
      { email: 'admin@unicamp.br', password: 'secret' },
      { origin: 'web', requestId: null },
    );

    expect(response.accessToken).toBe('token');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: userId, action: 'identity.login.succeeded' }),
    );
  });

  it('performs password work even when the e-mail is unknown', async () => {
    const identities: LocalIdentityReader = { findActiveByEmail: vi.fn().mockResolvedValue(null) };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(false) };
    const tokens: AccessTokenIssuer = { issue: vi.fn() };
    const audit: AuditEventWriter = { append: vi.fn() };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit);

    await expect(
      useCase.execute(
        { email: 'unknown@unicamp.br', password: 'secret' },
        { origin: 'web', requestId: null },
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(passwords.verify).toHaveBeenCalledWith('secret', null);
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
