import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { InvalidPasswordResetTokenError } from '../domain/errors/invalid-password-reset-token.error.js';
import type { AuditEventWriter } from '../domain/ports/audit-event-writer.port.js';
import type { LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type { PasswordResetNotifier } from '../domain/ports/password-reset-notifier.port.js';
import type {
  PasswordResetTokenConsumer,
  PasswordResetTokenWriter,
} from '../domain/ports/password-reset-token-repository.port.js';
import type { SecureTokenGenerator } from '../domain/ports/secure-token-generator.port.js';
import type { UserCredentialWriter } from '../domain/ports/user-credential-writer.port.js';
import {
  hashPasswordResetToken,
  passwordResetUrl,
} from '../domain/services/password-reset-token.js';
import { CompletePasswordResetUseCase } from './complete-password-reset.use-case.js';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case.js';

const now = '2026-08-14T00:00:00.000Z';
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const token = 'a'.repeat(64);
const requestContext = { origin: 'api:http', requestId: null };
const settings = {
  publicOrigin: 'https://cp2b.unicamp.br',
  basePath: '/arqueia',
  tokenTtlSeconds: 3_600,
};

function principalWith(overrides: Partial<AuthenticatedPrincipal['user']> = {}) {
  return {
    user: {
      id: userId,
      institutionId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      loginCode: 'ARQ-ADMIN-LOCAL',
      name: 'Usuário Unicamp',
      email: 'usuario@unicamp.br',
      academicCategory: 'PESQUISADOR' as const,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      ...overrides,
    },
    memberships: [],
    systemRoles: [],
  } satisfies AuthenticatedPrincipal;
}

function identitiesReturning(account: unknown): LocalIdentityReader {
  return {
    findActiveByEmail: vi.fn().mockResolvedValue(account),
    findActiveById: vi.fn(),
    recordLoginSuccess: vi.fn(),
    recordLoginFailure: vi.fn(),
  };
}

function tokenWriter(): PasswordResetTokenWriter {
  return {
    invalidatePending: vi.fn().mockResolvedValue(undefined),
    issue: vi.fn().mockResolvedValue(undefined),
  };
}

describe('RequestPasswordResetUseCase', () => {
  it('issues a single-use token and e-mails the link to the account owner', async () => {
    const identities = identitiesReturning({
      principal: principalWith(),
      passwordHash: 'hash',
      failedAttempts: 0,
      lockedUntil: null,
    });
    const tokens = tokenWriter();
    const notifier: PasswordResetNotifier = {
      channel: 'smtp',
      sendResetLink: vi.fn().mockResolvedValue(undefined),
    };
    const generator: SecureTokenGenerator = { generate: vi.fn().mockReturnValue(token) };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RequestPasswordResetUseCase(
      identities,
      tokens,
      notifier,
      generator,
      audit,
      settings,
    );

    const response = await useCase.execute({ email: 'usuario@unicamp.br' }, requestContext);

    expect(response).toEqual({ acknowledged: true });
    expect(tokens.invalidatePending).toHaveBeenCalledWith(userId);
    expect(tokens.issue).toHaveBeenCalledWith(
      expect.objectContaining({ userId, tokenHash: hashPasswordResetToken(token) }),
    );
    expect(notifier.sendResetLink).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'usuario@unicamp.br',
        resetUrl: `https://cp2b.unicamp.br/arqueia/redefinir-senha?token=${token}`,
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'identity.password_reset.requested',
        actorId: userId,
        after: expect.objectContaining({ delivered: true, channel: 'smtp' }),
      }),
    );
  });

  it('never stores the raw token — only its SHA-256', async () => {
    const identities = identitiesReturning({
      principal: principalWith(),
      passwordHash: 'hash',
      failedAttempts: 0,
      lockedUntil: null,
    });
    const tokens = tokenWriter();
    const useCase = new RequestPasswordResetUseCase(
      identities,
      tokens,
      { channel: 'smtp', sendResetLink: vi.fn().mockResolvedValue(undefined) },
      { generate: vi.fn().mockReturnValue(token) },
      { append: vi.fn().mockResolvedValue(undefined) },
      settings,
    );

    await useCase.execute({ email: 'usuario@unicamp.br' }, requestContext);

    const issued = vi.mocked(tokens.issue).mock.calls[0]![0];
    expect(issued.tokenHash).not.toBe(token);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers the same way for an unknown e-mail, without issuing a token', async () => {
    const tokens = tokenWriter();
    const notifier: PasswordResetNotifier = { channel: 'smtp', sendResetLink: vi.fn() };
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RequestPasswordResetUseCase(
      identitiesReturning(null),
      tokens,
      notifier,
      { generate: vi.fn().mockReturnValue(token) },
      audit,
      settings,
    );

    const response = await useCase.execute({ email: 'ninguem@unicamp.br' }, requestContext);

    expect(response).toEqual({ acknowledged: true });
    expect(tokens.issue).not.toHaveBeenCalled();
    expect(notifier.sendResetLink).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        after: expect.objectContaining({ delivered: false }),
      }),
    );
  });

  it('refuses to send to a suspended account, the same way it refuses an unknown one', async () => {
    const tokens = tokenWriter();
    const notifier: PasswordResetNotifier = { channel: 'smtp', sendResetLink: vi.fn() };
    const useCase = new RequestPasswordResetUseCase(
      identitiesReturning({
        principal: principalWith({ status: 'SUSPENDED' }),
        passwordHash: 'hash',
        failedAttempts: 0,
        lockedUntil: null,
      }),
      tokens,
      notifier,
      { generate: vi.fn().mockReturnValue(token) },
      { append: vi.fn().mockResolvedValue(undefined) },
      settings,
    );

    await expect(
      useCase.execute({ email: 'usuario@unicamp.br' }, requestContext),
    ).resolves.toEqual({ acknowledged: true });
    expect(notifier.sendResetLink).not.toHaveBeenCalled();
  });

  it('still acknowledges when delivery fails, and records the failure in the audit trail', async () => {
    const audit: AuditEventWriter = { append: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RequestPasswordResetUseCase(
      identitiesReturning({
        principal: principalWith(),
        passwordHash: 'hash',
        failedAttempts: 0,
        lockedUntil: null,
      }),
      tokenWriter(),
      {
        channel: 'smtp',
        sendResetLink: vi.fn().mockRejectedValue(new Error('smtp recusou a conexão')),
      },
      { generate: vi.fn().mockReturnValue(token) },
      audit,
      settings,
    );

    await expect(
      useCase.execute({ email: 'usuario@unicamp.br' }, requestContext),
    ).resolves.toEqual({ acknowledged: true });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          delivered: false,
          failureReason: 'smtp recusou a conexão',
        }),
      }),
    );
  });
});

describe('CompletePasswordResetUseCase', () => {
  it('consumes the token by its hash and writes the new credential for its owner', async () => {
    const tokens: PasswordResetTokenConsumer = {
      consume: vi.fn().mockResolvedValue({ id: 'token-id', userId }),
    };
    const credentials: UserCredentialWriter = {
      setPasswordHash: vi.fn().mockResolvedValue(undefined),
    };
    const hasher: PasswordHasher = { hash: vi.fn().mockResolvedValue('novo-hash') };
    const useCase = new CompletePasswordResetUseCase(tokens, credentials, hasher);

    const result = await useCase.execute(
      { token, newPassword: 'senha-nova-123' },
      { origin: 'api:http', requestId: null },
    );

    expect(result).toEqual({ success: true });
    expect(tokens.consume).toHaveBeenCalledWith(hashPasswordResetToken(token));
    expect(credentials.setPasswordHash).toHaveBeenCalledWith(
      userId,
      'novo-hash',
      expect.objectContaining({ actorId: userId, origin: 'api:http' }),
      'identity.user.password_reset_by_token',
    );
  });

  it('rejects a token the repository would not consume, without touching the credential', async () => {
    const credentials: UserCredentialWriter = { setPasswordHash: vi.fn() };
    const useCase = new CompletePasswordResetUseCase(
      { consume: vi.fn().mockResolvedValue(null) },
      credentials,
      { hash: vi.fn() },
    );

    await expect(
      useCase.execute({ token, newPassword: 'senha-nova-123' }, requestContext),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
    expect(credentials.setPasswordHash).not.toHaveBeenCalled();
  });
});

describe('passwordResetUrl', () => {
  it('keeps the deployment prefix, so the link does not 404 on the CP2b VM', () => {
    expect(passwordResetUrl('https://cp2b.unicamp.br/', '/arqueia', 'abc')).toBe(
      'https://cp2b.unicamp.br/arqueia/redefinir-senha?token=abc',
    );
  });

  it('builds a root-level link when there is no prefix', () => {
    expect(passwordResetUrl('http://localhost:4002', '', 'abc')).toBe(
      'http://localhost:4002/redefinir-senha?token=abc',
    );
  });
});
