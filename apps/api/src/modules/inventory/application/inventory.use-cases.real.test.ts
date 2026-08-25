import { describe, expect, it, beforeEach } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';

import { InMemoryInventoryRepository } from '../../../../test/in-memory/in-memory-inventory-repository.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { ListProductsUseCase } from './list-products.use-case.js';
import { CreateBatchEntryUseCase } from './create-batch-entry.use-case.js';
import { ListBatchesUseCase } from './list-batches.use-case.js';
import { WithdrawStockUseCase } from './withdraw-stock.use-case.js';
import { AdjustStockUseCase } from './adjust-stock.use-case.js';
import { ListStockMovementsUseCase } from './list-stock-movements.use-case.js';
import {
  InsufficientStockError,
  ProductConflictError,
  ProductNotFoundError,
} from '../domain/inventory.errors.js';

describe('Inventory Domain Real Use Cases & Edge Cases (No Mocks)', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const projectId = '33333333-3333-4333-a333-333333333333';
  const userId = '44444444-4444-4444-a444-444444444444';

  function createPrincipal(
    role: 'ADMIN' | 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
    laboratoryId = labAId,
  ): AuthenticatedPrincipal {
    const isSystemAdmin = role === 'ADMIN';
    return {
      user: {
        id: userId,
        institutionId: 'inst-1',
        name: 'Pesquisador Laboratorial',
        email: 'pesquisador@arqueia.local',
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

  let repository: InMemoryInventoryRepository;
  let permissions: PermissionEvaluator;
  const context = { origin: 'api:test', requestId: 'req-123' };

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    permissions = new PermissionEvaluator();
  });

  describe('Product Management', () => {
    it('creates and lists products with search and category filtering', async () => {
      const createUseCase = new CreateProductUseCase(repository, permissions);
      const listUseCase = new ListProductsUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const p1 = await createUseCase.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-CITRATO-FE',
          name: 'Citrato Férrico Amoniacal',
          casNumber: '1185-57-5',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
          minimumStockThreshold: 2,
          description: 'Reagente para cultura microbiológica',
        },
        context,
      );

      const p2 = await createUseCase.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-EDTA-SAL',
          name: 'Ácido Etilenodiaminotetracético (EDTA)',
          casNumber: '6381-92-6',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
          minimumStockThreshold: 1,
        },
        context,
      );

      expect(p1.id).toBeDefined();
      expect(p1.code).toBe('PRD-CITRATO-FE');
      expect(p2.id).toBeDefined();

      // List all
      const all = await listUseCase.execute(tecnico, { laboratoryId: labAId, limit: 10 });
      expect(all.items).toHaveLength(2);

      // Search by CAS
      const searchCas = await listUseCase.execute(tecnico, {
        laboratoryId: labAId,
        search: '1185-57-5',
        limit: 10,
      });
      expect(searchCas.items).toHaveLength(1);
      expect(searchCas.items[0]!.code).toBe('PRD-CITRATO-FE');

      // Search by partial name
      const searchName = await listUseCase.execute(tecnico, {
        laboratoryId: labAId,
        search: 'EDTA',
        limit: 10,
      });
      expect(searchName.items).toHaveLength(1);
      expect(searchName.items[0]!.code).toBe('PRD-EDTA-SAL');
    });

    it('rejects duplicate product code in the same laboratory', async () => {
      const createUseCase = new CreateProductUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      await createUseCase.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-REAGENT-01',
          name: 'Produto Inicial',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          tecnico,
          {
            laboratoryId: labAId,
            code: 'PRD-REAGENT-01',
            name: 'Produto Duplicado',
            category: 'REAGENT',
            unitOfMeasure: 'FRASCO',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ProductConflictError);
    });

    it('allows identical product code in a different laboratory', async () => {
      const createUseCase = new CreateProductUseCase(repository, permissions);
      const admin = createPrincipal('ADMIN');

      const p1 = await createUseCase.execute(
        admin,
        {
          laboratoryId: labAId,
          code: 'PRD-COMMON-01',
          name: 'Produto Lab A',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      const p2 = await createUseCase.execute(
        admin,
        {
          laboratoryId: labBId,
          code: 'PRD-COMMON-01',
          name: 'Produto Lab B',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      expect(p1.id).not.toBe(p2.id);
      expect(p1.laboratoryId).toBe(labAId);
      expect(p2.laboratoryId).toBe(labBId);
    });

    it('denies product creation to unauthorized roles', async () => {
      const createUseCase = new CreateProductUseCase(repository, permissions);
      const usuario = createPrincipal('USUARIO');

      expect(() =>
        createUseCase.execute(
          usuario,
          {
            laboratoryId: labAId,
            code: 'PRD-TEST',
            name: 'Produto Teste',
            category: 'REAGENT',
            unitOfMeasure: 'FRASCO',
          },
          context,
        ),
      ).toThrow();
    });
  });

  describe('Batch & Stock Ledger (Movements, Balances & FIFO)', () => {
    it('creates batch entry with initial stock movement and derives balance', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const listBatches = new ListBatchesUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-NANO-FE',
          name: 'Óxido de Ferro Nanoparticulado',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      const batch = await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-2026-001',
          manufacturer: 'Sigma-Aldrich',
          initialQuantity: 10,
          qrCode: 'QR-SIGMA-FE-001',
        },
        context,
      );

      expect(batch.id).toBeDefined();
      expect(batch.currentBalance).toBe(10);
      expect(batch.status).toBe('AVAILABLE');

      // Verify movement ledger entry
      expect(repository.movements).toHaveLength(1);
      const movement = repository.movements[0]!;
      expect(movement.type).toBe('ENTRY');
      expect(movement.quantity).toBe(10);
      expect(movement.balanceAfter).toBe(10);
      expect(movement.userId).toBe(userId);

      // List batches returns computed balance
      const batchesList = await listBatches.execute(tecnico, {
        laboratoryId: labAId,
        productId: product.id,
        limit: 10,
      });
      expect(batchesList.items).toHaveLength(1);
      expect(batchesList.items[0]!.currentBalance).toBe(10);
    });

    it('rejects batch entry creation for non-existent product', async () => {
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      await expect(
        createBatch.execute(
          tecnico,
          {
            laboratoryId: labAId,
            productId: '00000000-0000-0000-0000-000000000000',
            batchNumber: 'LOT-INV',
            initialQuantity: 5,
            qrCode: 'QR-INVALID',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ProductNotFoundError);
    });

    it('rejects duplicate QR code on batch creation', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-HAMILTON-1L',
          name: 'Seringa Hamilton 1 L',
          category: 'CONSUMABLE',
          unitOfMeasure: 'UNIDADE',
        },
        context,
      );

      await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-HAM-01',
          initialQuantity: 2,
          qrCode: 'QR-HAMILTON-DUP',
        },
        context,
      );

      await expect(
        createBatch.execute(
          tecnico,
          {
            laboratoryId: labAId,
            productId: product.id,
            batchNumber: 'LOT-HAM-02',
            initialQuantity: 3,
            qrCode: 'QR-HAMILTON-DUP',
          },
          context,
        ),
      ).rejects.toThrow(/já está em uso/i);
    });

    it('executes partial withdrawals, updates balance, and prevents over-withdrawal', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const withdraw = new WithdrawStockUseCase(repository, permissions);
      const listMovements = new ListStockMovementsUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-ETH-96',
          name: 'Etanol 96%',
          category: 'SOLVENT',
          unitOfMeasure: 'L',
        },
        context,
      );

      const batch = await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-ETH-01',
          initialQuantity: 20,
          qrCode: 'QR-ETH-01',
        },
        context,
      );

      // Withdrawal 1: 5L
      const mov1 = await withdraw.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          projectId,
          quantity: 5,
          purpose: 'Preparo de reagentes',
        },
        context,
      );

      expect(mov1.type).toBe('WITHDRAWAL');
      expect(mov1.quantity).toBe(-5);
      expect(mov1.balanceAfter).toBe(15);

      // Withdrawal 2: 10L
      const mov2 = await withdraw.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          projectId,
          quantity: 10,
          purpose: 'Lavagem de vidrarias',
        },
        context,
      );

      expect(mov2.balanceAfter).toBe(5);

      // Over-withdrawal attempt: 6L when only 5L left
      await expect(
        withdraw.execute(
          tecnico,
          {
            laboratoryId: labAId,
            batchId: batch.id,
            projectId,
            quantity: 6,
            purpose: 'Tentativa excedente',
          },
          context,
        ),
      ).rejects.toThrow(InsufficientStockError);

      // Verify movements ledger
      const movements = await listMovements.execute(tecnico, {
        laboratoryId: labAId,
        batchId: batch.id,
        limit: 10,
      });
      expect(movements.items).toHaveLength(3); // 1 ENTRY + 2 WITHDRAWAL
    });

    it('transitions batch status to EXHAUSTED when balance reaches 0', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const withdraw = new WithdrawStockUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-COBALTO-5G',
          name: 'Nitrato de Cobalto 5g',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      const batch = await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-CO-01',
          initialQuantity: 1,
          qrCode: 'QR-CO-01',
        },
        context,
      );

      // Withdraw total quantity
      await withdraw.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          projectId,
          quantity: 1,
          purpose: 'Consumo integral do frasco',
        },
        context,
      );

      const updatedBatch = await repository.findBatchById(batch.id);
      expect(updatedBatch?.currentBalance).toBe(0);
      expect(updatedBatch?.status).toBe('EXHAUSTED');

      // Attempting withdrawal from exhausted batch
      await expect(
        withdraw.execute(
          tecnico,
          {
            laboratoryId: labAId,
            batchId: batch.id,
            projectId,
            quantity: 1,
            purpose: 'Retirada em lote esgotado',
          },
          context,
        ),
      ).rejects.toThrow(/indisponível para retirada/i);
    });

    it('performs stock adjustments with mandatory audit reason and updates status appropriately', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const adjust = new AdjustStockUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-TUBOS-BRANCO',
          name: 'Tubos de Coleta Branco 5mL',
          category: 'CONSUMABLE',
          unitOfMeasure: 'CAIXA',
        },
        context,
      );

      const batch = await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-TUB-01',
          initialQuantity: 10,
          qrCode: 'QR-TUB-01',
        },
        context,
      );

      // Adjustment down: found 8 in physical inventory
      const adjDown = await adjust.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          newBalance: 8,
          reason: 'Inventário físico identificou 2 unidades danificadas',
        },
        context,
      );

      expect(adjDown.type).toBe('ADJUSTMENT');
      expect(adjDown.quantity).toBe(-2);
      expect(adjDown.balanceAfter).toBe(8);
      expect(adjDown.reason).toBe('Inventário físico identificou 2 unidades danificadas');

      // Adjustment to 0: transitions to EXHAUSTED
      const adjZero = await adjust.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          newBalance: 0,
          reason: 'Descarte completo por perda de integridade',
        },
        context,
      );

      expect(adjZero.balanceAfter).toBe(0);
      let batchState = await repository.findBatchById(batch.id);
      expect(batchState?.status).toBe('EXHAUSTED');

      // Adjustment back up: found additional stock -> transitions back to AVAILABLE
      const adjUp = await adjust.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          newBalance: 5,
          reason: 'Localizado lote guardado no armário secundário',
        },
        context,
      );

      expect(adjUp.balanceAfter).toBe(5);
      batchState = await repository.findBatchById(batch.id);
      expect(batchState?.status).toBe('AVAILABLE');
    });

    it('maintains fractional decimal precision in micro-scale quantities', async () => {
      const createProduct = new CreateProductUseCase(repository, permissions);
      const createBatch = new CreateBatchEntryUseCase(repository, permissions);
      const withdraw = new WithdrawStockUseCase(repository, permissions);
      const tecnico = createPrincipal('TECNICO');

      const product = await createProduct.execute(
        tecnico,
        {
          laboratoryId: labAId,
          code: 'PRD-STANDARD-01',
          name: 'Padrão Cromatográfico Alta Pureza',
          category: 'STANDARD',
          unitOfMeasure: 'G',
        },
        context,
      );

      const batch = await createBatch.execute(
        tecnico,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-STD-01',
          initialQuantity: 1.0,
          qrCode: 'QR-STD-01',
        },
        context,
      );

      // Withdraw 0.125g
      const mov = await withdraw.execute(
        tecnico,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          projectId,
          quantity: 0.125,
          purpose: 'Preparo de curva analítica',
        },
        context,
      );

      expect(mov.balanceAfter).toBeCloseTo(0.875, 4);
    });
  });
});
