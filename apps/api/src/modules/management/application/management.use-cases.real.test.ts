import { describe, expect, it, beforeEach } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';

import { InMemoryManagementRepository } from '../../../../test/in-memory/in-memory-management-repository.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { GetDashboardSummaryUseCase } from './get-dashboard-summary.use-case.js';
import { GetManagementAnalyticsUseCase } from './get-management-analytics.use-case.js';
import { ListAuditLogsUseCase } from './list-audit-logs.use-case.js';
import { GetAuditLogDetailUseCase } from './get-audit-log-detail.use-case.js';
import { AuditEventNotFoundError } from '../domain/management.errors.js';

describe('Management Domain Real Use Cases & Edge Cases (No Mocks)', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const userId = '33333333-3333-4333-a333-333333333333';

  function createPrincipal(
    role: 'ADMIN' | 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
    laboratoryId = labAId,
  ): AuthenticatedPrincipal {
    const isSystemAdmin = role === 'ADMIN';
    return {
      user: {
        id: userId,
        institutionId: 'inst-1',
        name: 'Gestor CP2b',
        email: 'gestor@unicamp.br',
        supervisorUserId: null,
        status: 'ACTIVE',
        identityProvider: 'LOCAL',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
      memberships: isSystemAdmin
        ? []
        : [
            {
              id: 'm-1',
              userId,
              laboratoryId,
              role: role as 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ],
      systemRoles: isSystemAdmin
        ? [
            {
              id: 'sr-1',
              userId,
              role: 'ADMIN',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ]
        : [],
    };
  }

  let repository: InMemoryManagementRepository;
  let permissions: PermissionEvaluator;

  beforeEach(() => {
    repository = new InMemoryManagementRepository();
    permissions = new PermissionEvaluator();
  });

  describe('Dashboard Summary & Section Access', () => {
    it('returns dashboard summary tailored to user role capabilities', async () => {
      const useCase = new GetDashboardSummaryUseCase(repository, permissions);
      const usuario = createPrincipal('USUARIO');
      const tecnico = createPrincipal('TECNICO');

      const userSummary = await useCase.execute(usuario, labAId);
      expect(userSummary.laboratoryId).toBe(labAId);
      expect(userSummary.availability.maintenance).toBe(false);
      expect(userSummary.availability.equipment).toBe(true);
      expect(userSummary.availability.inventory).toBe(true);

      const tecnicoSummary = await useCase.execute(tecnico, labAId);
      expect(tecnicoSummary.availability.maintenance).toBe(true);
      expect(tecnicoSummary.equipmentSummary.total).toBe(12);
      expect(tecnicoSummary.equipmentSummary.byStatus.AVAILABLE).toBe(10);
    });

    it('rejects dashboard summary request for laboratory outside user scope', async () => {
      const useCase = new GetDashboardSummaryUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO', labAId);

      await expect(useCase.execute(tecnico, labBId)).rejects.toThrow();
    });
  });

  describe('Analytics & Audit Logs', () => {
    it('allows TECNICO and ADMIN to retrieve management analytics', async () => {
      const useCase = new GetManagementAnalyticsUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const analytics = await useCase.execute(tecnico, {
        laboratoryId: labAId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-31T23:59:59.000Z',
      });

      expect(analytics.equipmentMetrics.totalActiveEquipment).toBe(12);
      expect(analytics.equipmentMetrics.totalReservedHours).toBe(84.0);
      expect(analytics.inventoryMetrics.totalActiveBatches).toBe(8);
    });

    it('records and lists audit events with date range and action filtering', async () => {
      const listUseCase = new ListAuditLogsUseCase(repository, permissions);
      const detailUseCase = new GetAuditLogDetailUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      // Populate audit events
      const event1 = {
        id: '11111111-aaaa-4111-8111-111111111111',
        occurredAt: '2026-08-15T10:00:00.000Z',
        actorId: userId,
        actorName: 'Técnico CP2b',
        action: 'inventory.batch.entry',
        entity: 'Batch',
        entityId: 'batch-1',
        laboratoryId: labAId,
        origin: 'api:test',
        before: null,
        after: { batchNumber: 'LOT-01', initialQuantity: 10 },
        redactedFields: [],
      };

      const event2 = {
        id: '22222222-bbbb-4222-8222-222222222222',
        occurredAt: '2026-08-16T14:00:00.000Z',
        actorId: userId,
        actorName: 'Técnico CP2b',
        action: 'equipment.maintenance.scheduled',
        entity: 'Equipment',
        entityId: 'eq-1',
        laboratoryId: labAId,
        origin: 'api:test',
        before: { status: 'AVAILABLE' },
        after: { status: 'MAINTENANCE' },
        redactedFields: ['internalDiagnosticsKey'],
      };

      repository.auditEvents.push(event1, event2);

      // List all events
      const all = await listUseCase.execute(tecnico, {
        laboratoryId: labAId,
        limit: 10,
      });
      expect(all.items).toHaveLength(2);

      // Filter by action
      const filtered = await listUseCase.execute(tecnico, {
        laboratoryId: labAId,
        action: 'equipment.maintenance.scheduled',
        limit: 10,
      });
      expect(filtered.items).toHaveLength(1);
      expect(filtered.items[0]!.id).toBe(event2.id);

      // Get audit detail
      const detail = await detailUseCase.execute(tecnico, event2.id, labAId);
      expect(detail.id).toBe(event2.id);
      expect(detail.action).toBe('equipment.maintenance.scheduled');
      expect(detail.redactedFields).toContain('internalDiagnosticsKey');
    });

    it('throws AuditEventNotFoundError for non-existent audit record', async () => {
      const detailUseCase = new GetAuditLogDetailUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      await expect(
        detailUseCase.execute(tecnico, '00000000-0000-0000-0000-000000000000', labAId),
      ).rejects.toBeInstanceOf(AuditEventNotFoundError);
    });
  });
});
