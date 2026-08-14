import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdjustStockUseCase } from './adjust-stock.use-case.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { WithdrawStockUseCase } from './withdraw-stock.use-case.js';
import { InsufficientStockError } from '../domain/inventory.errors.js';
import type { InventoryRepository } from '../domain/ports/inventory-repository.port.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

describe('Inventory Use Cases Unit Tests (Checkpoint 3)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const productId = '22222222-2222-4222-a222-222222222222';
  const batchId = '33333333-3333-4333-a333-333333333333';
  const projectId = '44444444-4444-4444-a444-444444444444';

  const principal: AuthenticatedPrincipal = {
    user: {
      id: '55555555-5555-4555-a555-555555555555',
      institutionId: 'inst-1',
      name: 'Pesquisador Unicamp',
      email: 'pesquisador@unicamp.br',
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

  let mockRepository: InventoryRepository;
  let permissions: PermissionEvaluator;

  beforeEach(() => {
    mockRepository = {
      createProduct: vi.fn(),
      listProducts: vi.fn(),
      createBatchEntry: vi.fn(),
      listBatches: vi.fn(),
      findBatchById: vi.fn(),
      findBatchByQrCode: vi.fn(),
      withdrawStock: vi.fn(),
      adjustStock: vi.fn(),
      listMovements: vi.fn(),
    };
    permissions = new PermissionEvaluator();
  });

  it('allows a TECNICO to create a product', async () => {
    const useCase = new CreateProductUseCase(mockRepository, permissions);
    const mockProduct = {
      id: productId,
      laboratoryId: labId,
      code: 'ETH-PA-1L',
      name: 'Etanol Anidro PA',
      casNumber: '64-17-5',
      category: 'SOLVENT' as const,
      unitOfMeasure: 'L' as const,
      minimumStockThreshold: 10,
      description: null,
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    };
    vi.spyOn(mockRepository, 'createProduct').mockResolvedValue(mockProduct);

    const result = await useCase.execute(
      principal,
      {
        laboratoryId: labId,
        code: 'ETH-PA-1L',
        name: 'Etanol Anidro PA',
        category: 'SOLVENT',
        unitOfMeasure: 'L',
      },
      { origin: 'test', requestId: null },
    );

    expect(result).toEqual(mockProduct);
  });

  it('allows stock withdrawal when balance is sufficient', async () => {
    const useCase = new WithdrawStockUseCase(mockRepository, permissions);
    const mockMovement = {
      id: 'mov-1',
      laboratoryId: labId,
      batchId,
      productId,
      userId: principal.user.id,
      projectId,
      type: 'WITHDRAWAL' as const,
      quantity: 2,
      balanceAfter: 8,
      purpose: 'Reação de síntese',
      reason: null,
      performedAt: '2026-08-14T00:00:00.000Z',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    };
    vi.spyOn(mockRepository, 'withdrawStock').mockResolvedValue(mockMovement);

    const result = await useCase.execute(
      principal,
      {
        laboratoryId: labId,
        batchId,
        projectId,
        quantity: 2,
        purpose: 'Reação de síntese',
      },
      { origin: 'test', requestId: null },
    );

    expect(result.balanceAfter).toBe(8);
  });

  it('throws InsufficientStockError when requested quantity exceeds available stock', async () => {
    const useCase = new WithdrawStockUseCase(mockRepository, permissions);
    vi.spyOn(mockRepository, 'withdrawStock').mockRejectedValue(
      new InsufficientStockError(50, 5),
    );

    await expect(
      useCase.execute(
        principal,
        {
          laboratoryId: labId,
          batchId,
          projectId,
          quantity: 50,
          purpose: 'Tentativa de retirada acima do estoque',
        },
        { origin: 'test', requestId: null },
      ),
    ).rejects.toThrow('Saldo insuficiente no lote (solicitado: 50, disponível em estoque: 5).');
  });

  it('allows TECNICO to perform stock adjustment with audit reason', async () => {
    const useCase = new AdjustStockUseCase(mockRepository, permissions);
    const mockAdjustment = {
      id: 'mov-2',
      laboratoryId: labId,
      batchId,
      productId,
      userId: principal.user.id,
      projectId: null,
      type: 'ADJUSTMENT' as const,
      quantity: -2,
      balanceAfter: 10,
      purpose: null,
      reason: 'Ajuste pós-inventário mensal.',
      performedAt: '2026-08-14T00:00:00.000Z',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    };
    vi.spyOn(mockRepository, 'adjustStock').mockResolvedValue(mockAdjustment);

    const result = await useCase.execute(
      principal,
      {
        laboratoryId: labId,
        batchId,
        newBalance: 10,
        reason: 'Ajuste pós-inventário mensal.',
      },
      { origin: 'test', requestId: null },
    );

    expect(result.reason).toBe('Ajuste pós-inventário mensal.');
  });
});
