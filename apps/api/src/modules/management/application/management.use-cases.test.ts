import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GetAuditLogDetailUseCase } from './get-audit-log-detail.use-case.js';
import { GetDashboardSummaryUseCase } from './get-dashboard-summary.use-case.js';
import { GetManagementAnalyticsUseCase } from './get-management-analytics.use-case.js';
import { GetProjectUsageUseCase } from './get-project-usage.use-case.js';
import { ListAuditLogsUseCase } from './list-audit-logs.use-case.js';
import { AuditEventNotFoundError } from '../domain/management.errors.js';
import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

describe('Management Use Cases Unit Tests (Canonical Plan)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const auditId = '77777777-7777-4777-a777-777777777777';

  const tecnicoPrincipal: AuthenticatedPrincipal = {
    user: {
      id: '55555555-5555-4555-a555-555555555555',
      institutionId: 'inst-1',
      name: 'Técnico CP2b',
      email: 'tecnico@unicamp.br',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    },
    memberships: [
      {
        id: 'm1',
        userId: '55555555-5555-4555-a555-555555555555',
        laboratoryId: labId,
        role: 'TECNICO',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
    systemRoles: [],
  };

  const usuarioPrincipal: AuthenticatedPrincipal = {
    ...tecnicoPrincipal,
    memberships: [
      {
        id: 'm2',
        userId: '55555555-5555-4555-a555-555555555555',
        laboratoryId: labId,
        role: 'USUARIO',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
  };

  const responsavelControladosPrincipal: AuthenticatedPrincipal = {
    ...tecnicoPrincipal,
    memberships: [
      {
        id: 'm3',
        userId: '55555555-5555-4555-a555-555555555555',
        laboratoryId: labId,
        role: 'RESPONSAVEL_CONTROLADOS',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
  };

  let mockRepository: ManagementRepository;
  let permissions: PermissionEvaluator;

  beforeEach(() => {
    mockRepository = {
      getDashboardSummary: vi.fn(),
      getAnalytics: vi.fn(),
      getProjectUsage: vi.fn(),
      listAuditLogs: vi.fn(),
      getAuditLogDetail: vi.fn(),
    };
    permissions = new PermissionEvaluator();
  });

  it('loads the Home with section access derived from permissions in the selected laboratory', async () => {
    const useCase = new GetDashboardSummaryUseCase(mockRepository, permissions);
    const summary = {
      laboratoryId: labId,
      timezone: 'America/Sao_Paulo',
      equipmentSummary: { total: 0, byStatus: { AVAILABLE: 0, UNDER_EVALUATION: 0, UNAVAILABLE: 0, MAINTENANCE: 0 } },
      todayReservations: [],
      upcomingActions: [],
      inventoryAlerts: [],
      quickActions: [],
      availability: { equipment: true, scheduling: true, inventory: true, maintenance: false, pendingActions: false },
      generatedAt: '2026-08-14T00:00:00.000Z',
    } as const;
    vi.mocked(mockRepository.getDashboardSummary).mockResolvedValue(summary);

    const result = await useCase.execute(usuarioPrincipal, labId);

    expect(mockRepository.getDashboardSummary).toHaveBeenCalledWith(labId, {
      equipment: true,
      scheduling: true,
      inventory: true,
      maintenance: false,
    });
    expect(result.quickActions.map(({ id }) => id)).toEqual(['scheduling', 'inventory', 'equipment']);
  });

  it('does not query the Home for a laboratory outside the membership scope', async () => {
    const useCase = new GetDashboardSummaryUseCase(mockRepository, permissions);

    await expect(useCase.execute(usuarioPrincipal, auditId)).rejects.toThrow();
    expect(mockRepository.getDashboardSummary).not.toHaveBeenCalled();
  });

  it('allows TECNICO to get management analytics for their laboratory', async () => {
    const useCase = new GetManagementAnalyticsUseCase(mockRepository, permissions);
    const mockAnalytics = {
      laboratoryId: labId,
      timezone: 'America/Sao_Paulo',
      period: {
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-14T23:59:59.000Z',
      },
      equipmentMetrics: {
        totalActiveEquipment: 5,
        totalReservedHours: 48.5,
        reservationCount: 12,
      },
      inventoryMetrics: {
        totalActiveBatches: 8,
        lowStockProductsCount: 1,
        expiringBatchesCount: 0,
        totalWithdrawalsCount: 10,
      },
      generatedAt: '2026-08-14T12:00:00.000Z',
    };

    vi.spyOn(mockRepository, 'getAnalytics').mockResolvedValue(mockAnalytics);

    const result = await useCase.execute(tecnicoPrincipal, {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
    });

    expect(result.equipmentMetrics.totalActiveEquipment).toBe(5);
  });

  it('denies access to RESPONSAVEL_CONTROLADOS for general audit log list', async () => {
    const useCase = new ListAuditLogsUseCase(mockRepository, permissions);

    expect(() =>
      useCase.execute(responsavelControladosPrincipal, {
        laboratoryId: labId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-14T23:59:59.000Z',
      }),
    ).toThrow();
  });

  it('allows TECNICO to fetch paginated project usage', async () => {
    const useCase = new GetProjectUsageUseCase(mockRepository, permissions);
    const mockPage = {
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    };

    vi.spyOn(mockRepository, 'getProjectUsage').mockResolvedValue(mockPage);

    const result = await useCase.execute(tecnicoPrincipal, {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
      limit: 20,
    });

    expect(result.items.length).toBe(0);
  });

  it('denies access to USUARIO trying to read management reports', async () => {
    const useCase = new GetManagementAnalyticsUseCase(mockRepository, permissions);

    expect(() =>
      useCase.execute(usuarioPrincipal, {
        laboratoryId: labId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-14T23:59:59.000Z',
      }),
    ).toThrow();
  });

  it('sanitizes audit detail payload returning redactedFields array', async () => {
    const useCase = new GetAuditLogDetailUseCase(mockRepository, permissions);
    const mockDetail = {
      id: auditId,
      occurredAt: '2026-08-14T12:00:00.000Z',
      actorId: tecnicoPrincipal.user.id,
      actorName: tecnicoPrincipal.user.name,
      action: 'inventory.product.created',
      entity: 'Product',
      entityId: 'p1',
      laboratoryId: labId,
      origin: 'api:test',
      before: null,
      after: {
        id: 'p1',
        name: 'Acetona PA',
        code: 'ACT-PA',
        category: 'SOLVENT',
        unitOfMeasure: 'ML',
      },
      redactedFields: ['internalSecretField'],
    };

    vi.spyOn(mockRepository, 'getAuditLogDetail').mockResolvedValue(mockDetail);

    const result = await useCase.execute(tecnicoPrincipal, auditId, labId);

    expect(result.redactedFields).toContain('internalSecretField');
  });

  it('throws AuditEventNotFoundError when audit record does not exist', async () => {
    const useCase = new GetAuditLogDetailUseCase(mockRepository, permissions);
    vi.spyOn(mockRepository, 'getAuditLogDetail').mockResolvedValue(null);

    await expect(useCase.execute(tecnicoPrincipal, auditId, labId)).rejects.toThrow(
      AuditEventNotFoundError,
    );
  });
});
