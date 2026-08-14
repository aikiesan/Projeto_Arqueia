import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it } from 'vitest';

import { AuthorizationDeniedError } from '../errors/authorization-denied.error.js';
import { PermissionEvaluator } from './permission-evaluator.js';

const labA = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const labB = 'e902893a-9d22-3c7e-a7b8-d6e313b71d9f';

function principal(role: 'USUARIO' | 'TECNICO', admin = false): AuthenticatedPrincipal {
  const now = '2026-08-14T00:00:00.000Z';
  const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  return {
    user: {
      id: userId,
      institutionId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      name: 'Pessoa Teste',
      email: 'pessoa@unicamp.br',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    memberships: [
      {
        id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
        userId,
        laboratoryId: labA,
        role,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    systemRoles: admin
      ? [
          {
            id: '6ba7b813-9dad-11d1-80b4-00c04fd430c8',
            userId,
            role: 'ADMIN',
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ]
      : [],
  };
}

describe('PermissionEvaluator', () => {
  const evaluator = new PermissionEvaluator();

  it('allows a user to operate only in the laboratory of the membership', () => {
    const user = principal('USUARIO');

    expect(evaluator.can(user, 'inventory.withdraw', labA)).toBe(true);
    expect(evaluator.can(user, 'inventory.withdraw', labB)).toBe(false);
    expect(evaluator.can(user, 'inventory.manage', labA)).toBe(false);
  });

  it('allows a technician to manage inventory but not global identity', () => {
    const technician = principal('TECNICO');

    expect(evaluator.can(technician, 'inventory.manage', labA)).toBe(true);
    expect(evaluator.can(technician, 'identity.user.manage')).toBe(false);
  });

  it('allows an active system administrator independent of laboratory', () => {
    const admin = principal('USUARIO', true);

    expect(evaluator.can(admin, 'identity.user.manage')).toBe(true);
    expect(evaluator.can(admin, 'inventory.manage', labB)).toBe(true);
  });

  it('denies archived memberships and suspended users', () => {
    const archived = principal('TECNICO');
    archived.memberships[0]!.archivedAt = '2026-08-14T00:01:00.000Z';
    expect(evaluator.can(archived, 'inventory.manage', labA)).toBe(false);

    const suspended = principal('TECNICO');
    suspended.user.status = 'SUSPENDED';
    expect(evaluator.can(suspended, 'inventory.manage', labA)).toBe(false);
  });

  it('throws a domain error when assertion fails', () => {
    expect(() => evaluator.assertCan(principal('USUARIO'), 'audit.read', labA)).toThrow(
      AuthorizationDeniedError,
    );
  });
});
