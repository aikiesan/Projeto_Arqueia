import { describe, expect, it } from 'vitest';
import type { AuthenticatedPrincipal, LaboratoryRole } from '@arqueia/contracts';
import { Algorithm, hash, verify } from '@node-rs/argon2';

import { PermissionEvaluator } from '../domain/services/permission-evaluator.js';

describe('Identity & RBAC Domain Real Tests (No Mocks)', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const evaluator = new PermissionEvaluator();

  function principalWithMemberships(
    memberships: Array<{ laboratoryId: string; role: LaboratoryRole }>,
    hasSystemAdmin = false,
  ): AuthenticatedPrincipal {
    return {
      user: {
        id: 'user-1',
        institutionId: 'inst-1',
        name: 'Usuário Teste',
        email: 'usuario@unicamp.br',
        supervisorUserId: null,
        status: 'ACTIVE',
        identityProvider: 'LOCAL',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
      memberships: memberships.map((m, idx) => ({
        id: `m-${idx}`,
        userId: 'user-1',
        laboratoryId: m.laboratoryId,
        role: m.role,
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      })),
      systemRoles: hasSystemAdmin
        ? [
            {
              id: 'sr-1',
              userId: 'user-1',
              role: 'ADMIN',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ]
        : [],
    };
  }

  describe('RBAC Multi-Tenant Cross-Lab Isolation', () => {
    it('grants global access to system ADMIN across all laboratories', () => {
      const admin = principalWithMemberships([], true);

      expect(evaluator.can(admin, 'equipment.manage', labAId)).toBe(true);
      expect(evaluator.can(admin, 'equipment.manage', labBId)).toBe(true);
      expect(evaluator.can(admin, 'inventory.withdraw', labAId)).toBe(true);
      expect(evaluator.can(admin, 'inventory.manage', labBId)).toBe(true);
      expect(evaluator.can(admin, 'scheduling.block.manage', labAId)).toBe(true);
      expect(evaluator.can(admin, 'audit.read', labAId)).toBe(true);
    });

    it('isolates TECNICO permissions strictly to their designated laboratory', () => {
      const tecnicoLabA = principalWithMemberships([{ laboratoryId: labAId, role: 'TECNICO' }]);

      // Allowed in Lab A
      expect(evaluator.can(tecnicoLabA, 'equipment.manage', labAId)).toBe(true);
      expect(evaluator.can(tecnicoLabA, 'inventory.manage', labAId)).toBe(true);
      expect(evaluator.can(tecnicoLabA, 'inventory.withdraw', labAId)).toBe(true);
      expect(evaluator.can(tecnicoLabA, 'scheduling.block.manage', labAId)).toBe(true);
      expect(evaluator.can(tecnicoLabA, 'audit.read', labAId)).toBe(true);

      // Strictly forbidden in Lab B
      expect(evaluator.can(tecnicoLabA, 'equipment.manage', labBId)).toBe(false);
      expect(evaluator.can(tecnicoLabA, 'inventory.manage', labBId)).toBe(false);
      expect(evaluator.can(tecnicoLabA, 'inventory.withdraw', labBId)).toBe(false);
      expect(evaluator.can(tecnicoLabA, 'scheduling.block.manage', labBId)).toBe(false);
      expect(evaluator.can(tecnicoLabA, 'inventory.read', labBId)).toBe(false);
    });

    it('enforces least privilege for USUARIO (can reserve and withdraw, but cannot manage equipment or blocks)', () => {
      const usuario = principalWithMemberships([{ laboratoryId: labAId, role: 'USUARIO' }]);

      expect(evaluator.can(usuario, 'equipment.read', labAId)).toBe(true);
      expect(evaluator.can(usuario, 'inventory.read', labAId)).toBe(true);
      expect(evaluator.can(usuario, 'inventory.withdraw', labAId)).toBe(true);
      expect(evaluator.can(usuario, 'scheduling.reserve', labAId)).toBe(true);
      expect(evaluator.can(usuario, 'scheduling.cancel', labAId)).toBe(true);

      expect(evaluator.can(usuario, 'equipment.manage', labAId)).toBe(false);
      expect(evaluator.can(usuario, 'inventory.manage', labAId)).toBe(false);
      expect(evaluator.can(usuario, 'scheduling.block.manage', labAId)).toBe(false);
      expect(evaluator.can(usuario, 'audit.read', labAId)).toBe(false);
    });

    it('restricts RESPONSAVEL_CONTROLADOS to authorized controlled substance scope', () => {
      const respControlados = principalWithMemberships([
        { laboratoryId: labAId, role: 'RESPONSAVEL_CONTROLADOS' },
      ]);

      expect(evaluator.can(respControlados, 'controlled.authorize', labAId)).toBe(true);
      expect(evaluator.can(respControlados, 'inventory.read', labAId)).toBe(true);
      expect(evaluator.can(respControlados, 'identity.laboratory.read', labAId)).toBe(true);

      expect(evaluator.can(respControlados, 'inventory.withdraw', labAId)).toBe(false);
      expect(evaluator.can(respControlados, 'equipment.manage', labAId)).toBe(false);
      expect(evaluator.can(respControlados, 'scheduling.reserve', labAId)).toBe(false);
    });
  });

  describe('Password Security & Argon2id Invariants', () => {
    it('hashes passwords with Argon2id parameters and validates matches', async () => {
      const password = 'SuperSecurePassword2026!';
      const hashValue = await hash(password, {
        algorithm: Algorithm.Argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
        outputLen: 32,
      });

      expect(hashValue).toMatch(/^\$argon2id\$/);

      // Verify correct password
      const match = await verify(hashValue, password, { algorithm: Algorithm.Argon2id });
      expect(match).toBe(true);

      // Verify wrong password fails
      const wrongMatch = await verify(hashValue, 'WrongPassword123!', { algorithm: Algorithm.Argon2id });
      expect(wrongMatch).toBe(false);
    });
  });
});
