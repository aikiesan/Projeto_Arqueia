import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import type { AccessTokenIssuer } from '../domain/ports/access-token-issuer.port.js';
import type { AuditEventWriter } from '../domain/ports/audit-event-writer.port.js';
import type { LocalIdentityAccount, LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import { LoginLocalUseCase } from './login-local.use-case.js';
import { AuthRateLimiterService } from '../infrastructure/auth-rate-limiter.service.js';

const now = '2026-08-14T00:00:00.000Z';
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const principal: AuthenticatedPrincipal = {
  user: {
    id: userId,
    institutionId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    loginCode: 'ARQ-ADMIN-LOCAL',
    name: 'Usuário Unicamp',
    email: 'usuario@unicamp.br',
    academicCategory: 'PESQUISADOR',
    status: 'ACTIVE',
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
  memberships: [],
  systemRoles: [],
};

describe('LoginLocalUseCase & Security Hardening', () => {
  it('issues a token, resets failed attempts, and appends identity.login.succeeded audit after valid login', async () => {
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue({
        principal,
        passwordHash: 'hash',
        failedAttempts: 2,
        lockedUntil: null,
      }),
      findActiveById: vi.fn(),
      recordLoginSuccess: vi.fn().mockResolvedValue(undefined),
      recordLoginFailure: vi.fn(),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(true) };
    const tokens: AccessTokenIssuer = {
      issue: vi.fn().mockResolvedValue({ accessToken: 'token', expiresInSeconds: 900 }),
    };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit, 5, 900);

    const response = await useCase.execute(
      { email: 'admin@unicamp.br', password: 'secret' },
      { origin: 'web', requestId: '11111111-1111-4111-a111-111111111111' },
    );

    expect(response.accessToken).toBe('token');
    expect(identities.recordLoginSuccess).toHaveBeenCalledWith(userId);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        action: 'identity.login.succeeded',
        entity: 'User',
        entityId: userId,
        before: null,
        after: null,
      }),
    );
  });

  it('records failure and emits identity.login.failed audit when password is incorrect on existing account', async () => {
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue({
        principal,
        passwordHash: 'hash',
        failedAttempts: 1,
        lockedUntil: null,
      }),
      findActiveById: vi.fn(),
      recordLoginSuccess: vi.fn(),
      recordLoginFailure: vi.fn().mockResolvedValue({ failedAttempts: 2, isLocked: false, lockedUntil: null }),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(false) };
    const tokens: AccessTokenIssuer = { issue: vi.fn() };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit, 3, 900);

    await expect(
      useCase.execute(
        { email: 'admin@unicamp.br', password: 'wrong-password' },
        { origin: 'web', requestId: '22222222-2222-4222-a222-222222222222' },
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(identities.recordLoginFailure).toHaveBeenCalledWith(userId, 3, 900);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        action: 'identity.login.failed',
        entity: 'User',
        entityId: userId,
        after: { reason: 'invalid_credentials' },
      }),
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('performs constant-time dummy verification and emits anonymized audit for unknown code without leaking existence', async () => {
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue(null),
      findActiveById: vi.fn(),
      recordLoginSuccess: vi.fn(),
      recordLoginFailure: vi.fn(),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(false) };
    const tokens: AccessTokenIssuer = { issue: vi.fn() };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit);

    await expect(
      useCase.execute(
        { email: 'naoexiste@unicamp.br', password: 'secret' },
        { origin: 'web', requestId: null },
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(passwords.verify).toHaveBeenCalledWith('secret', null);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        action: 'identity.login.failed',
        entity: 'User',
        entityId: '00000000-0000-0000-0000-000000000000',
        after: { reason: 'invalid_credentials' },
      }),
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('blocks authentication and logs account_locked audit when account is actively locked', async () => {
    const lockedUntilFuture = new Date(Date.now() + 600_000).toISOString();
    const lockedAccount: LocalIdentityAccount = {
      principal,
      passwordHash: 'hash',
      failedAttempts: 5,
      lockedUntil: lockedUntilFuture,
    };
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue(lockedAccount),
      findActiveById: vi.fn(),
      recordLoginSuccess: vi.fn(),
      recordLoginFailure: vi.fn(),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(true) };
    const tokens: AccessTokenIssuer = { issue: vi.fn() };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit, 5, 900);

    await expect(
      useCase.execute(
        { email: 'admin@unicamp.br', password: 'secret' },
        { origin: 'web', requestId: '33333333-3333-4333-a333-333333333333' },
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(passwords.verify).toHaveBeenCalledWith('secret', 'hash');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        action: 'identity.login.failed',
        entity: 'User',
        entityId: userId,
        after: { reason: 'account_locked' },
      }),
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('allows login if lockout duration has expired', async () => {
    const lockedUntilPast = new Date(Date.now() - 10_000).toISOString();
    const expiredLockAccount: LocalIdentityAccount = {
      principal,
      passwordHash: 'hash',
      failedAttempts: 5,
      lockedUntil: lockedUntilPast,
    };
    const identities: LocalIdentityReader = {
      findActiveByEmail: vi.fn().mockResolvedValue(expiredLockAccount),
      findActiveById: vi.fn(),
      recordLoginSuccess: vi.fn().mockResolvedValue(undefined),
      recordLoginFailure: vi.fn(),
    };
    const passwords: PasswordVerifier = { verify: vi.fn().mockResolvedValue(true) };
    const tokens: AccessTokenIssuer = {
      issue: vi.fn().mockResolvedValue({ accessToken: 'token-after-lockout', expiresInSeconds: 900 }),
    };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new LoginLocalUseCase(identities, passwords, tokens, audit, 5, 900);

    const response = await useCase.execute(
      { email: 'admin@unicamp.br', password: 'correct-secret' },
      { origin: 'web', requestId: null },
    );

    expect(response.accessToken).toBe('token-after-lockout');
    expect(identities.recordLoginSuccess).toHaveBeenCalledWith(userId);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        action: 'identity.login.succeeded',
      }),
    );
  });
});

describe('AuthRateLimiterService', () => {
  it('allows requests within threshold and blocks subsequent requests when exceeded', () => {
    const limiter = new AuthRateLimiterService(3, 60); // 3 attempts per 60s
    const key = '192.168.1.50';

    const req1 = limiter.consume(key);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = limiter.consume(key);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = limiter.consume(key);
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);

    const req4 = limiter.consume(key);
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);
    expect(req4.resetTimeMs).toBeGreaterThan(Date.now());
  });

  it('resets rate limit for a specific key', () => {
    const limiter = new AuthRateLimiterService(2, 60);
    const key = '10.0.0.1';

    limiter.consume(key);
    limiter.consume(key);
    expect(limiter.consume(key).allowed).toBe(false);

    limiter.reset(key);
    expect(limiter.consume(key).allowed).toBe(true);
  });
});
