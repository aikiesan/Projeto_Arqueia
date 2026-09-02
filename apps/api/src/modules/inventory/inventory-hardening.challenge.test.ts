import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

import { InMemoryInventoryRepository } from '../../../test/in-memory/in-memory-inventory-repository.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { AuthorizationDeniedError } from '../identity/domain/errors/authorization-denied.error.js';
import { CreateProductUseCase } from './application/create-product.use-case.js';
import type { ListProductsUseCase } from './application/list-products.use-case.js';
import { CreateBatchEntryUseCase } from './application/create-batch-entry.use-case.js';
import { ListBatchesUseCase } from './application/list-batches.use-case.js';
import { WithdrawStockUseCase } from './application/withdraw-stock.use-case.js';
import { AdjustStockUseCase } from './application/adjust-stock.use-case.js';
import type { ListStockMovementsUseCase } from './application/list-stock-movements.use-case.js';
import { InsufficientStockError } from './domain/inventory.errors.js';
import { PostgresInventoryRepository } from './infrastructure/postgres-inventory-repository.js';
import { InventoryExceptionFilter } from './interface/inventory-exception.filter.js';
import { InventoryController } from './interface/inventory.controller.js';
import { SchedulingExceptionFilter } from '../scheduling/interface/scheduling-exception.filter.js';
import { SchedulingController } from '../scheduling/interface/scheduling.controller.js';
import { ManagementExceptionFilter } from '../management/interface/management-exception.filter.js';
import { ManagementController } from '../management/interface/management.controller.js';
import type { ListScheduleUseCase } from '../scheduling/application/list-schedule.use-case.js';
import type { CreateReservationUseCase } from '../scheduling/application/create-reservation.use-case.js';
import type { StartWalkInReservationUseCase } from '../scheduling/application/start-walk-in-reservation.use-case.js';
import type { CheckInReservationUseCase } from '../scheduling/application/check-in-reservation.use-case.js';
import type { CompleteReservationUseCase } from '../scheduling/application/complete-reservation.use-case.js';
import type { ReleaseAbsentReservationsUseCase } from '../scheduling/application/release-absent-reservations.use-case.js';
import type { CancelReservationUseCase } from '../scheduling/application/cancel-reservation.use-case.js';
import type { CreateTechnicalBlockUseCase } from '../scheduling/application/create-technical-block.use-case.js';
import type { CancelTechnicalBlockUseCase } from '../scheduling/application/cancel-technical-block.use-case.js';
import type { GetDashboardSummaryUseCase } from '../management/application/get-dashboard-summary.use-case.js';
import type { GetManagementAnalyticsUseCase } from '../management/application/get-management-analytics.use-case.js';
import type { GetProjectUsageUseCase } from '../management/application/get-project-usage.use-case.js';
import type { ListAuditLogsUseCase } from '../management/application/list-audit-logs.use-case.js';
import type { GetAuditLogDetailUseCase } from '../management/application/get-audit-log-detail.use-case.js';

describe('Milestone 3 Challenge Suite: Stock Ledger & RBAC Hardening', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const userIdA = '33333333-3333-4333-a333-333333333333';
  const userIdB = '44444444-4444-4444-a444-444444444444';
  const adminUserId = '55555555-5555-4555-a555-555555555555';
  const projectIdA = '66666666-6666-4666-a666-666666666666';
  const equipmentIdA = '77777777-7777-4777-a777-777777777777';

  const context = { origin: 'api:test', requestId: 'req-challenge-m3' };

  function makePrincipal(
    userId: string,
    role: 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS' | 'ADMIN',
    laboratoryId: string,
  ): AuthenticatedPrincipal {
    const isSystemAdmin = role === 'ADMIN';
    return {
      user: {
        id: userId,
        institutionId: 'inst-1',
        name: `User ${role}`,
        email: `${role.toLowerCase()}@test.local`,
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
              id: `m-${userId}`,
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
              id: `sr-${userId}`,
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

  const principalLabA = makePrincipal(userIdA, 'TECNICO', labAId);
  const _principalLabB = makePrincipal(userIdB, 'TECNICO', labBId);
  const principalAdmin = makePrincipal(adminUserId, 'ADMIN', labAId);

  function captureFilterResponse(filter: { catch: (err: Error, host: unknown) => void }, error: Error) {
    let capturedStatusCode = 0;
    let capturedBody: Record<string, unknown> = {};

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: (statusCode: number) => {
            capturedStatusCode = statusCode;
            return {
              json: (body: Record<string, unknown>) => {
                capturedBody = body;
              },
            };
          },
        }),
      }),
    };

    filter.catch(error, host);
    return { statusCode: capturedStatusCode, body: capturedBody };
  }

  describe('1. Mixed Stock Ledger Movements & Mathematical Equality Stress Test', () => {
    let inMemRepo: InMemoryInventoryRepository;
    let permissions: PermissionEvaluator;
    let createProductUseCase: CreateProductUseCase;
    let createBatchUseCase: CreateBatchEntryUseCase;
    let withdrawUseCase: WithdrawStockUseCase;
    let adjustUseCase: AdjustStockUseCase;
    let listBatchesUseCase: ListBatchesUseCase;

    beforeEach(() => {
      inMemRepo = new InMemoryInventoryRepository();
      permissions = new PermissionEvaluator();
      createProductUseCase = new CreateProductUseCase(inMemRepo, permissions);
      createBatchUseCase = new CreateBatchEntryUseCase(inMemRepo, permissions);
      withdrawUseCase = new WithdrawStockUseCase(inMemRepo, permissions);
      adjustUseCase = new AdjustStockUseCase(inMemRepo, permissions);
      listBatchesUseCase = new ListBatchesUseCase(inMemRepo, permissions);
    });

    it('confirms exact mathematical equality across complex sequences of mixed movements (ENTRY, WITHDRAWAL, DISCARD, pos ADJUSTMENT, neg ADJUSTMENT)', async () => {
      const product = await createProductUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          code: 'PRD-REAGENT-LEDGER-1',
          name: 'Ledger Test Reagent',
          category: 'REAGENT',
          unitOfMeasure: 'FRASCO',
        },
        context,
      );

      // Step 1: Initial ENTRY of 100 units
      const initialBatch = await createBatchUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-LEDGER-01',
          initialQuantity: 100,
          qrCode: 'QR-LEDGER-01',
        },
        context,
      );

      let runningExpectedBalance = 100;
      expect(initialBatch.currentBalance).toBe(runningExpectedBalance);

      // Movement 2: WITHDRAWAL -20.50
      const mov2 = await withdrawUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: initialBatch.id,
          projectId: projectIdA,
          quantity: 20.5,
          purpose: 'Withdrawal step 1',
        },
        context,
      );
      runningExpectedBalance -= 20.5; // 79.5
      expect(mov2.balanceAfter).toBe(runningExpectedBalance);

      // Movement 3: Manual DISCARD -5.00
      inMemRepo.movements.push({
        id: randomUUID(),
        laboratoryId: labAId,
        batchId: initialBatch.id,
        productId: product.id,
        userId: userIdA,
        projectId: null,
        type: 'DISCARD' as const,
        quantity: -5.0,
        balanceAfter: runningExpectedBalance - 5.0,
        purpose: 'Vencimento parcial',
        reason: 'Descarte controlado',
        performedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      });
      runningExpectedBalance -= 5.0; // 74.5

      // Movement 4: Positive ADJUSTMENT (+15.50 -> new balance 90.00)
      const mov4 = await adjustUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: initialBatch.id,
          newBalance: 90,
          reason: 'Inventário físico localizou 15.5 unidades adicionais',
        },
        context,
      );
      runningExpectedBalance = 90;
      expect(mov4.balanceAfter).toBe(runningExpectedBalance);
      expect(mov4.quantity).toBe(15.5); // delta

      // Movement 5: Negative ADJUSTMENT (-30.00 -> new balance 60.00)
      const mov5 = await adjustUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: initialBatch.id,
          newBalance: 60,
          reason: 'Inventário físico encontrou quebra',
        },
        context,
      );
      runningExpectedBalance = 60;
      expect(mov5.balanceAfter).toBe(runningExpectedBalance);
      expect(mov5.quantity).toBe(-30); // delta

      // Movement 6: WITHDRAWAL -12.25
      const mov6 = await withdrawUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: initialBatch.id,
          projectId: projectIdA,
          quantity: 12.25,
          purpose: 'Withdrawal step 2',
        },
        context,
      );
      runningExpectedBalance -= 12.25; // 47.75
      expect(mov6.balanceAfter).toBe(runningExpectedBalance);

      // Movement 7: Additional DISCARD -7.75
      inMemRepo.movements.push({
        id: randomUUID(),
        laboratoryId: labAId,
        batchId: initialBatch.id,
        productId: product.id,
        userId: userIdA,
        projectId: null,
        type: 'DISCARD' as const,
        quantity: -7.75,
        balanceAfter: runningExpectedBalance - 7.75,
        purpose: 'Descarte de alíquota contaminada',
        reason: 'Contaminação',
        performedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      });
      runningExpectedBalance -= 7.75; // 40.0

      // Movement 8: Positive ADJUSTMENT (+25.0 -> new balance 65.0)
      const mov8 = await adjustUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: initialBatch.id,
          newBalance: 65,
          reason: 'Ajuste pós-auditoria',
        },
        context,
      );
      runningExpectedBalance = 65;
      expect(mov8.balanceAfter).toBe(runningExpectedBalance);

      // Compare single-batch query vs list-batch aggregation
      const singleBatch = await inMemRepo.findBatchById(initialBatch.id);
      const listResult = await listBatchesUseCase.execute(principalLabA, {
        laboratoryId: labAId,
        productId: product.id,
      });

      expect(singleBatch?.currentBalance).toBe(65);
      expect(listResult.items[0]!.currentBalance).toBe(65);
      expect(singleBatch?.currentBalance).toBe(listResult.items[0]!.currentBalance);
    });

    it('verifies SQL formula consistency between Postgres single batch and list aggregation', async () => {
      let capturedListSql = '';
      let capturedSingleSql = '';

      const validBatchId = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';
      const validProdId = '88888888-8888-4888-a888-888888888888';

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT b.id, b.laboratory_id')) {
            capturedListSql = sql;
            return Promise.resolve({
              rows: [
                {
                  id: validBatchId,
                  laboratory_id: labAId,
                  product_id: validProdId,
                  batch_number: 'LOT-1',
                  manufacturer: 'Sigma',
                  expiration_date: null,
                  received_date: new Date(),
                  space_option_id: null,
                  bench_option_id: null,
                  initial_quantity: '100',
                  qr_code: 'QR-1',
                  status: 'AVAILABLE',
                  notes: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                  current_balance: '65.0000',
                },
              ],
            });
          }
          if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
            capturedSingleSql = sql;
            return Promise.resolve({
              rows: [{ balance: '65.0000' }],
            });
          }
          if (sql.includes('FROM batches') && sql.includes('WHERE id = $1')) {
            return Promise.resolve({
              rows: [
                {
                  id: validBatchId,
                  laboratory_id: labAId,
                  product_id: validProdId,
                  batch_number: 'LOT-1',
                  manufacturer: 'Sigma',
                  expiration_date: null,
                  received_date: new Date(),
                  space_option_id: null,
                  bench_option_id: null,
                  initial_quantity: '100',
                  qr_code: 'QR-1',
                  status: 'AVAILABLE',
                  notes: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as DatabasePool;

      const pgRepo = new PostgresInventoryRepository(mockPool);

      const batchSingle = await pgRepo.findBatchById(validBatchId);
      const batchList = await pgRepo.listBatches({ laboratoryId: labAId });

      expect(batchSingle?.currentBalance).toBe(65);
      expect(batchList.items[0]?.currentBalance).toBe(65);

      // Verify listBatches SQL expression includes all movement types
      expect(capturedListSql).toContain("WHEN sm.movement_type = 'ENTRY' THEN sm.quantity");
      expect(capturedListSql).toContain("WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity");
      expect(capturedListSql).toContain("WHEN sm.movement_type = 'ADJUSTMENT' THEN sm.quantity");

      // Verify calculateBatchBalance SQL expression includes all movement types
      expect(capturedSingleSql).toContain("WHEN movement_type = 'ENTRY' THEN quantity");
      expect(capturedSingleSql).toContain("WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity");
      expect(capturedSingleSql).toContain("WHEN movement_type = 'ADJUSTMENT' THEN quantity");
    });
  });

  describe('2. Insufficient Stock Withdrawal & Zero Corruption Stress Test', () => {
    let inMemRepo: InMemoryInventoryRepository;
    let permissions: PermissionEvaluator;
    let createProductUseCase: CreateProductUseCase;
    let createBatchUseCase: CreateBatchEntryUseCase;
    let withdrawUseCase: WithdrawStockUseCase;

    beforeEach(() => {
      inMemRepo = new InMemoryInventoryRepository();
      permissions = new PermissionEvaluator();
      createProductUseCase = new CreateProductUseCase(inMemRepo, permissions);
      createBatchUseCase = new CreateBatchEntryUseCase(inMemRepo, permissions);
      withdrawUseCase = new WithdrawStockUseCase(inMemRepo, permissions);
    });

    it('rejects withdrawal when requested quantity exceeds available balance and leaves ledger completely uncorrupted', async () => {
      const product = await createProductUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          code: 'PRD-INSUFFICIENT-TEST',
          name: 'Precision Chemical',
          category: 'REAGENT',
          unitOfMeasure: 'G',
        },
        context,
      );

      const batch = await createBatchUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          productId: product.id,
          batchNumber: 'LOT-INSUF-01',
          initialQuantity: 10.0,
          qrCode: 'QR-INSUF-01',
        },
        context,
      );

      const movementsCountBefore = inMemRepo.movements.length;
      expect(movementsCountBefore).toBe(1); // Only initial ENTRY

      // Attempt 1: slightly over available (10.0001)
      await expect(
        withdrawUseCase.execute(
          principalLabA,
          {
            laboratoryId: labAId,
            batchId: batch.id,
            projectId: projectIdA,
            quantity: 10.0001,
            purpose: 'Attempt slightly over',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(InsufficientStockError);

      // Attempt 2: vastly over available (100.0)
      await expect(
        withdrawUseCase.execute(
          principalLabA,
          {
            laboratoryId: labAId,
            batchId: batch.id,
            projectId: projectIdA,
            quantity: 100.0,
            purpose: 'Attempt vastly over',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(InsufficientStockError);

      // Verify zero new movements were inserted into ledger
      expect(inMemRepo.movements.length).toBe(movementsCountBefore);

      // Verify balance remains exactly 10.0
      const currentBatchState = await inMemRepo.findBatchById(batch.id);
      expect(currentBatchState?.currentBalance).toBe(10.0);
      expect(currentBatchState?.status).toBe('AVAILABLE');

      // Verify that a subsequent valid withdrawal of full 10.0 succeeds immediately
      const successfulMov = await withdrawUseCase.execute(
        principalLabA,
        {
          laboratoryId: labAId,
          batchId: batch.id,
          projectId: projectIdA,
          quantity: 10.0,
          purpose: 'Valid exact balance withdrawal',
        },
        context,
      );

      expect(successfulMov.balanceAfter).toBe(0);
      expect(inMemRepo.movements.length).toBe(movementsCountBefore + 1);

      const exhaustedBatchState = await inMemRepo.findBatchById(batch.id);
      expect(exhaustedBatchState?.currentBalance).toBe(0);
      expect(exhaustedBatchState?.status).toBe('EXHAUSTED');

      // Attempt 3: withdrawal from exhausted batch is rejected
      await expect(
        withdrawUseCase.execute(
          principalLabA,
          {
            laboratoryId: labAId,
            batchId: batch.id,
            projectId: projectIdA,
            quantity: 1.0,
            purpose: 'Attempt from exhausted batch',
          },
          context,
        ),
      ).rejects.toThrow(/indisponível para retirada/i);
    });
  });

  describe('3. Cross-Laboratory Unauthorized Access Boundary Challenge Suite', () => {
    let inMemRepo: InMemoryInventoryRepository;
    let permissions: PermissionEvaluator;

    beforeEach(() => {
      inMemRepo = new InMemoryInventoryRepository();
      permissions = new PermissionEvaluator();
    });

    it('confirms PermissionEvaluator rejects non-member and non-admin cross-laboratory access with AuthorizationDeniedError', () => {
      // User with membership in Lab A trying to access Lab B
      expect(() => {
        permissions.assertCan(principalLabA, 'inventory.read', labBId);
      }).toThrow(AuthorizationDeniedError);

      expect(() => {
        permissions.assertCan(principalLabA, 'inventory.manage', labBId);
      }).toThrow(AuthorizationDeniedError);

      expect(() => {
        permissions.assertCan(principalLabA, 'scheduling.reserve', labBId);
      }).toThrow(AuthorizationDeniedError);

      expect(() => {
        permissions.assertCan(principalLabA, 'scheduling.block.manage', labBId);
      }).toThrow(AuthorizationDeniedError);

      expect(() => {
        permissions.assertCan(principalLabA, 'management.report.read', labBId);
      }).toThrow(AuthorizationDeniedError);

      // System ADMIN can access any laboratory
      expect(() => {
        permissions.assertCan(principalAdmin, 'inventory.read', labBId);
        permissions.assertCan(principalAdmin, 'scheduling.reserve', labBId);
        permissions.assertCan(principalAdmin, 'management.report.read', labBId);
      }).not.toThrow();
    });

    describe('Inventory Endpoints Cross-Lab Denial -> HTTP 403 { code: AUTHORIZATION_DENIED }', () => {
      const inventoryFilter = new InventoryExceptionFilter();

      it('enforces HTTP 403 on createProduct across labs', async () => {
        const createProductUseCase = new CreateProductUseCase(inMemRepo, permissions);
        const controller = new InventoryController(
          inMemRepo,
          createProductUseCase,
          {} as ListProductsUseCase,
          {} as CreateBatchEntryUseCase,
          {} as ListBatchesUseCase,
          {} as WithdrawStockUseCase,
          {} as AdjustStockUseCase,
          {} as ListStockMovementsUseCase,
        );

        let error: unknown = null;
        try {
          await controller.createProduct(
            principalLabA,
            {
              laboratoryId: labBId, // Cross-lab
              code: 'CROSS-PRD-1',
              name: 'Cross Product',
              category: 'REAGENT',
              unitOfMeasure: 'FRASCO',
            },
            { ip: '127.0.0.1' } as never,
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(inventoryFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          message: (error as AuthorizationDeniedError).message,
          code: 'AUTHORIZATION_DENIED',
        });
      });

      it('enforces HTTP 403 on listBatches across labs', async () => {
        const listBatchesUseCase = new ListBatchesUseCase(inMemRepo, permissions);
        const controller = new InventoryController(
          inMemRepo,
          {} as CreateProductUseCase,
          {} as ListProductsUseCase,
          {} as CreateBatchEntryUseCase,
          listBatchesUseCase,
          {} as WithdrawStockUseCase,
          {} as AdjustStockUseCase,
          {} as ListStockMovementsUseCase,
        );

        let error: unknown = null;
        try {
          await controller.listBatches(principalLabA, { laboratoryId: labBId });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(inventoryFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });

      it('enforces HTTP 403 on withdrawStock across labs', async () => {
        const withdrawStockUseCase = new WithdrawStockUseCase(inMemRepo, permissions);
        const controller = new InventoryController(
          inMemRepo,
          {} as CreateProductUseCase,
          {} as ListProductsUseCase,
          {} as CreateBatchEntryUseCase,
          {} as ListBatchesUseCase,
          withdrawStockUseCase,
          {} as AdjustStockUseCase,
          {} as ListStockMovementsUseCase,
        );

        let error: unknown = null;
        try {
          await controller.withdrawStock(
            principalLabA,
            {
              laboratoryId: labBId,
              batchId: '00000000-0000-0000-0000-000000000000',
              projectId: projectIdA,
              quantity: 1,
              purpose: 'Cross-lab withdrawal',
            },
            { ip: '127.0.0.1' } as never,
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(inventoryFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });

      it('enforces HTTP 403 on adjustStock across labs', async () => {
        const adjustStockUseCase = new AdjustStockUseCase(inMemRepo, permissions);
        const controller = new InventoryController(
          inMemRepo,
          {} as CreateProductUseCase,
          {} as ListProductsUseCase,
          {} as CreateBatchEntryUseCase,
          {} as ListBatchesUseCase,
          {} as WithdrawStockUseCase,
          adjustStockUseCase,
          {} as ListStockMovementsUseCase,
        );

        let error: unknown = null;
        try {
          await controller.adjustStock(
            principalLabA,
            {
              laboratoryId: labBId,
              batchId: '00000000-0000-0000-0000-000000000000',
              newBalance: 10,
              reason: 'Cross-lab adjustment',
            },
            { ip: '127.0.0.1' } as never,
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(inventoryFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    describe('Scheduling Endpoints Cross-Lab Denial -> HTTP 403 { code: AUTHORIZATION_DENIED }', () => {
      const schedulingFilter = new SchedulingExceptionFilter();

      it('enforces HTTP 403 on createReservation across labs', async () => {
        const createReservationUseCase = {
          execute: vi.fn().mockImplementation((principal, input) => {
            permissions.assertCan(principal, 'scheduling.reserve', input.laboratoryId);
            return Promise.resolve({});
          }),
        } as unknown as CreateReservationUseCase;

        const controller = new SchedulingController(
          {} as ListScheduleUseCase,
          createReservationUseCase,
          {} as StartWalkInReservationUseCase,
          {} as CheckInReservationUseCase,
          {} as CompleteReservationUseCase,
          {} as ReleaseAbsentReservationsUseCase,
          {} as CancelReservationUseCase,
          {} as CreateTechnicalBlockUseCase,
          {} as CancelTechnicalBlockUseCase,
        );

        let error: unknown = null;
        try {
          await controller.reserve(principalLabA, {
            laboratoryId: labBId, // Cross-lab
            equipmentId: equipmentIdA,
            projectId: projectIdA,
            startsAt: '2026-08-25T10:00:00.000Z',
            endsAt: '2026-08-25T12:00:00.000Z',
            purpose: 'Cross-lab reservation',
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(schedulingFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          message: (error as AuthorizationDeniedError).message,
          code: 'AUTHORIZATION_DENIED',
        });
      });

      it('enforces HTTP 403 on createTechnicalBlock across labs', async () => {
        const createTechnicalBlockUseCase = {
          execute: vi.fn().mockImplementation((principal, input) => {
            permissions.assertCan(principal, 'scheduling.block.manage', input.laboratoryId);
            return Promise.resolve({});
          }),
        } as unknown as CreateTechnicalBlockUseCase;

        const controller = new SchedulingController(
          {} as ListScheduleUseCase,
          {} as CreateReservationUseCase,
          {} as StartWalkInReservationUseCase,
          {} as CheckInReservationUseCase,
          {} as CompleteReservationUseCase,
          {} as ReleaseAbsentReservationsUseCase,
          {} as CancelReservationUseCase,
          createTechnicalBlockUseCase,
          {} as CancelTechnicalBlockUseCase,
        );

        let error: unknown = null;
        try {
          await controller.block(principalLabA, {
            laboratoryId: labBId, // Cross-lab
            equipmentId: equipmentIdA,
            startsAt: '2026-08-25T14:00:00.000Z',
            endsAt: '2026-08-25T18:00:00.000Z',
            reason: 'Manutenção preventiva cross-lab',
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(schedulingFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });
    });

    describe('Management Endpoints Cross-Lab Denial -> HTTP 403 { code: AUTHORIZATION_DENIED }', () => {
      const managementFilter = new ManagementExceptionFilter();

      it('enforces HTTP 403 on getDashboardSummary across labs', async () => {
        const getDashboardSummaryUseCase = {
          execute: vi.fn().mockImplementation((principal, labId) => {
            permissions.assertCan(principal, 'management.report.read', labId);
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

        let error: unknown = null;
        try {
          await controller.getDashboardSummary(principalLabA, labBId);
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(managementFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          message: (error as AuthorizationDeniedError).message,
          code: 'AUTHORIZATION_DENIED',
        });
      });

      it('enforces HTTP 403 on getAnalytics across labs', async () => {
        const getAnalyticsUseCase = {
          execute: vi.fn().mockImplementation((principal, query) => {
            permissions.assertCan(principal, 'management.report.read', query.laboratoryId);
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

        let error: unknown = null;
        try {
          await controller.getAnalytics(principalLabA, {
            laboratoryId: labBId,
            startsAt: '2026-08-01T00:00:00.000Z',
            endsAt: '2026-08-24T23:59:59.000Z',
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(managementFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });

      it('enforces HTTP 403 on listAuditLogs across labs', async () => {
        const listAuditLogsUseCase = {
          execute: vi.fn().mockImplementation((principal, query) => {
            permissions.assertCan(principal, 'audit.read', query.laboratoryId);
            return Promise.resolve({});
          }),
        } as unknown as ListAuditLogsUseCase;

        const controller = new ManagementController(
          {} as GetDashboardSummaryUseCase,
          {} as GetManagementAnalyticsUseCase,
          {} as GetProjectUsageUseCase,
          listAuditLogsUseCase,
          {} as GetAuditLogDetailUseCase,
        );

        let error: unknown = null;
        try {
          await controller.listAuditLogs(principalLabA, {
            laboratoryId: labBId,
            startsAt: '2026-08-01T00:00:00.000Z',
            endsAt: '2026-08-24T23:59:59.000Z',
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(AuthorizationDeniedError);
        const response = captureFilterResponse(managementFilter, error as Error);
        expect(response.statusCode).toBe(403);
        expect(response.body.code).toBe('AUTHORIZATION_DENIED');
      });
    });
  });
});
