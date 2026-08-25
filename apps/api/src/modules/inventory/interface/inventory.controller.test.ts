import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import type { InventoryRepository } from '../domain/ports/inventory-repository.port.js';
import type { AdjustStockUseCase } from '../application/adjust-stock.use-case.js';
import type { CreateBatchEntryUseCase } from '../application/create-batch-entry.use-case.js';
import type { CreateProductUseCase } from '../application/create-product.use-case.js';
import type { ListBatchesUseCase } from '../application/list-batches.use-case.js';
import type { ListProductsUseCase } from '../application/list-products.use-case.js';
import type { ListStockMovementsUseCase } from '../application/list-stock-movements.use-case.js';
import type { WithdrawStockUseCase } from '../application/withdraw-stock.use-case.js';
import { InventoryExceptionFilter } from './inventory-exception.filter.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController Cross-Laboratory RBAC & Exception Filter Integration', () => {
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

  it('rejects cross-laboratory inventory access with AuthorizationDeniedError mapped to HTTP 403', async () => {
    const listProductsUseCase = {
      execute: vi.fn().mockImplementation((principal, query) => {
        if (query.laboratoryId !== labAId) {
          throw new AuthorizationDeniedError();
        }
        return Promise.resolve({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }),
    } as unknown as ListProductsUseCase;

    const controller = new InventoryController(
      {} as InventoryRepository,
      {} as CreateProductUseCase,
      listProductsUseCase,
      {} as CreateBatchEntryUseCase,
      {} as ListBatchesUseCase,
      {} as WithdrawStockUseCase,
      {} as AdjustStockUseCase,
      {} as ListStockMovementsUseCase,
    );

    // Cross-laboratory request: user belonging to Lab A queries Lab B
    let caughtError: unknown = null;
    try {
      await controller.listProducts(principalLabA, { laboratoryId: labBId });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AuthorizationDeniedError);

    // Verify filter catches it and returns HTTP 403
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    new InventoryExceptionFilter().catch(caughtError as Error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: (caughtError as AuthorizationDeniedError).message,
      code: 'AUTHORIZATION_DENIED',
    });
  });
});
