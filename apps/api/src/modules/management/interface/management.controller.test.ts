import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import type { GetAuditLogDetailUseCase } from '../application/get-audit-log-detail.use-case.js';
import type { GetDashboardSummaryUseCase } from '../application/get-dashboard-summary.use-case.js';
import type { GetManagementAnalyticsUseCase } from '../application/get-management-analytics.use-case.js';
import type { GetProjectUsageUseCase } from '../application/get-project-usage.use-case.js';
import type { ListAuditLogsUseCase } from '../application/list-audit-logs.use-case.js';
import { ManagementExceptionFilter } from './management-exception.filter.js';
import { ManagementController } from './management.controller.js';

describe('ManagementController Cross-Laboratory RBAC & Exception Filter Integration', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const userId = '33333333-3333-4333-a333-333333333333';

  const principalLabA: AuthenticatedPrincipal = {
    user: {
      id: userId,
      institutionId: 'inst-1',
      name: 'Pesquisador Lab A',
      email: 'pesquisador@lab-a.local',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    },
    memberships: [
      {
        id: 'm-1',
        userId,
        laboratoryId: labAId,
        role: 'TECNICO',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
    systemRoles: [],
  };

  it('rejects cross-laboratory dashboard access with AuthorizationDeniedError mapped to HTTP 403', async () => {
    const getDashboardSummaryUseCase = {
      execute: vi.fn().mockImplementation((principal, labId) => {
        if (labId !== labAId) {
          throw new AuthorizationDeniedError();
        }
        return Promise.resolve({});
      }),
    } as unknown as GetDashboardSummaryUseCase;

    const controller = new ManagementController(
      getDashboardSummaryUseCase,
      {} as GetManagementAnalyticsUseCase,
      {} as GetProjectUsageUseCase,
      {} as ListAuditLogsUseCase,
      {} as GetAuditLogDetailUseCase,
    );

    let caughtError: unknown = null;
    try {
      await controller.getDashboardSummary(principalLabA, labBId);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AuthorizationDeniedError);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    new ManagementExceptionFilter().catch(caughtError as Error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: (caughtError as AuthorizationDeniedError).message,
      code: 'AUTHORIZATION_DENIED',
    });
  });

  it('rejects cross-laboratory analytics access with AuthorizationDeniedError mapped to HTTP 403', async () => {
    const getAnalyticsUseCase = {
      execute: vi.fn().mockImplementation((principal, query) => {
        if (query.laboratoryId !== labAId) {
          throw new AuthorizationDeniedError();
        }
        return Promise.resolve({});
      }),
    } as unknown as GetManagementAnalyticsUseCase;

    const controller = new ManagementController(
      {} as GetDashboardSummaryUseCase,
      getAnalyticsUseCase,
      {} as GetProjectUsageUseCase,
      {} as ListAuditLogsUseCase,
      {} as GetAuditLogDetailUseCase,
    );

    let caughtError: unknown = null;
    try {
      await controller.getAnalytics(principalLabA, {
        laboratoryId: labBId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-24T23:59:59.000Z',
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AuthorizationDeniedError);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    new ManagementExceptionFilter().catch(caughtError as Error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: (caughtError as AuthorizationDeniedError).message,
      code: 'AUTHORIZATION_DENIED',
    });
  });
});
