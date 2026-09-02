import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AccessTokenVerifier } from '../domain/ports/access-token-verifier.port.js';
import type { PrincipalReader } from '../domain/ports/principal-reader.port.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function principal(mustChangePassword: boolean): AuthenticatedPrincipal {
  return {
    user: {
      id: userId,
      institutionId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      loginCode: 'ARQ-PESSOA-01',
      academicCategory: 'PESQUISADOR',
      status: 'ACTIVE',
      mustChangePassword,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      archivedAt: null,
    },
    memberships: [],
    systemRoles: [],
  };
}

function httpContext(path: string): { context: ExecutionContext; request: Request } {
  const request = {
    path,
    header: vi.fn((name: string) =>
      name.toLowerCase() === 'authorization' ? 'Bearer valid-token' : undefined,
    ),
  } as unknown as Request;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function guard(account: AuthenticatedPrincipal): JwtAuthGuard {
  const tokens: AccessTokenVerifier = {
    verify: vi.fn(async () => ({ subject: userId })),
  };
  const principals: PrincipalReader = {
    findByUserId: vi.fn(async () => account),
  };
  return new JwtAuthGuard(tokens, principals);
}

describe('JwtAuthGuard mandatory password change', () => {
  it('blocks application routes until the temporary password is changed', async () => {
    const { context } = httpContext('/api/equipment');

    await expect(guard(principal(true)).canActivate(context)).rejects.toMatchObject({
      response: { code: 'PASSWORD_CHANGE_REQUIRED' },
    });
  });

  it.each(['/api/auth/me', '/api/auth/change-password'])(
    'allows %s while password change is pending',
    async (path) => {
      const { context, request } = httpContext(path);
      const account = principal(true);

      await expect(guard(account).canActivate(context)).resolves.toBe(true);
      expect(request).toMatchObject({ principal: account });
    },
  );

  it('allows normal routes after the password has been changed', async () => {
    const { context } = httpContext('/api/equipment');

    await expect(guard(principal(false)).canActivate(context)).resolves.toBe(true);
  });

  it('uses a forbidden response for the mandatory-change gate', async () => {
    const { context } = httpContext('/api/equipment');

    try {
      await guard(principal(true)).canActivate(context);
      throw new Error('expected mandatory password gate to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
    }
  });
});
