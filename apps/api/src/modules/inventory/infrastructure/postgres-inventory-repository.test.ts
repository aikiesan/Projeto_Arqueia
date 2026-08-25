import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { InsufficientStockError } from '../domain/inventory.errors.js';
import { PostgresInventoryRepository } from './postgres-inventory-repository.js';

describe('PostgresInventoryRepository Unit & SQL Ledger Tests', () => {
  const laboratoryId = '11111111-1111-4111-a111-111111111111';
  const productId = '22222222-2222-4222-a222-222222222222';
  const batchId = '33333333-3333-4333-a333-333333333333';
  const movementId = '55555555-5555-4555-a555-555555555555';
  const actorId = '44444444-4444-4444-a444-444444444444';
  const context = { actorId, origin: 'api:test', requestId: 'req-123' };

  it('aggregates stock ledger movements in listBatches including ENTRY, WITHDRAWAL, DISCARD, and ADJUSTMENT', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        capturedSql = sql;
        capturedParams = params ?? [];

        return Promise.resolve({
          rows: [
            {
              id: batchId,
              laboratory_id: laboratoryId,
              product_id: productId,
              batch_number: 'LOT-2026-X1',
              manufacturer: 'Sigma',
              expiration_date: new Date('2027-12-31T00:00:00.000Z'),
              received_date: new Date('2026-08-01T10:00:00.000Z'),
              space_option_id: null,
              bench_option_id: null,
              initial_quantity: '100.0000',
              qr_code: 'ARQ-LOT-33333333-3333-4333-a333-333333333333',
              status: 'AVAILABLE',
              notes: 'Armazenado em geladeira',
              created_at: new Date('2026-08-01T10:00:00.000Z'),
              updated_at: new Date('2026-08-01T10:00:00.000Z'),
              archived_at: null,
              // Calculation: 100 (ENTRY) - 20 (WITHDRAWAL) - 5 (DISCARD) + 15 (ADJUSTMENT) = 90
              current_balance: '90.0000',
            },
          ],
        });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);

    const result = await repository.listBatches({
      laboratoryId,
      productId,
      search: 'LOT_%2026',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.currentBalance).toBe(90);
    expect(result.items[0]!.batchNumber).toBe('LOT-2026-X1');

    // Verify SQL query contains all movement types in aggregation
    expect(capturedSql).toContain("WHEN sm.movement_type = 'ENTRY' THEN sm.quantity");
    expect(capturedSql).toContain("WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity");
    expect(capturedSql).toContain("WHEN sm.movement_type = 'ADJUSTMENT' THEN sm.quantity");
    expect(capturedSql).toContain('LEFT JOIN stock_movements sm ON sm.batch_id = b.id');
    expect(capturedSql).toContain('b.laboratory_id = $1');

    // Verify parameters escaping
    expect(capturedParams[0]).toBe(laboratoryId);
    expect(capturedParams[1]).toBe(productId);
    expect(capturedParams[4]).toBe('%LOT\\_\\%2026%');
    expect(capturedParams[5]).toBe(null);
    expect(capturedParams[6]).toBe(null);
    expect(capturedParams[7]).toBe(11);
  });

  it('calculates batch balance correctly from stock movements without masking', async () => {
    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM batches') && sql.includes('WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: batchId,
                laboratory_id: laboratoryId,
                product_id: productId,
                batch_number: 'LOT-2026-VAL',
                manufacturer: 'Merck',
                expiration_date: null,
                received_date: new Date('2026-08-01T10:00:00.000Z'),
                space_option_id: null,
                bench_option_id: null,
                initial_quantity: '10.0000',
                qr_code: 'ARQ-LOT-VAL',
                status: 'AVAILABLE',
                notes: null,
                created_at: new Date('2026-08-01T10:00:00.000Z'),
                updated_at: new Date('2026-08-01T10:00:00.000Z'),
                archived_at: null,
              },
            ],
          });
        }
        if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
          return Promise.resolve({
            rows: [{ balance: '5.0000' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);
    const batch = await repository.findBatchById(batchId);

    expect(batch).not.toBeNull();
    expect(batch?.currentBalance).toBe(5);
  });

  it('applies keyset cursor in listProducts SQL query', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        capturedSql = sql;
        capturedParams = params ?? [];
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);
    const cursorProductId = '88888888-8888-4888-a888-888888888888';

    await repository.listProducts({
      laboratoryId,
      category: 'REAGENT',
      cursor: cursorProductId,
      limit: 15,
    });

    expect(capturedSql).toContain('(lower(p.name), p.id) >');
    expect(capturedSql).toContain('cursor_product.id = $4');
    expect(capturedParams[0]).toBe(laboratoryId);
    expect(capturedParams[1]).toBe('REAGENT');
    expect(capturedParams[3]).toBe(cursorProductId);
    expect(capturedParams[4]).toBe(16);
  });

  it('applies keyset cursor in listMovements SQL query', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        capturedSql = sql;
        capturedParams = params ?? [];
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);
    const cursorMovementId = '99999999-9999-4999-a999-999999999999';

    await repository.listMovements({
      laboratoryId,
      batchId,
      cursor: cursorMovementId,
      limit: 20,
    });

    expect(capturedSql).toContain('(sm.performed_at, sm.id) <');
    expect(capturedSql).toContain('cursor_sm.id = $6');
    expect(capturedParams[0]).toBe(laboratoryId);
    expect(capturedParams[1]).toBe(batchId);
    expect(capturedParams[5]).toBe(cursorMovementId);
    expect(capturedParams[6]).toBe(21);
  });

  it('calculates batch balance correctly on findBatchById including ENTRY, WITHDRAWAL, DISCARD, and ADJUSTMENT', async () => {
    let movementQuerySql = '';

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string, _params?: unknown[]) => {
        if (sql.includes('FROM batches') && sql.includes('WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: batchId,
                laboratory_id: laboratoryId,
                product_id: productId,
                batch_number: 'LOT-2026-002',
                manufacturer: 'Merck',
                expiration_date: new Date('2028-01-01T00:00:00.000Z'),
                received_date: new Date('2026-08-01T10:00:00.000Z'),
                space_option_id: null,
                bench_option_id: null,
                initial_quantity: '50.0000',
                qr_code: 'ARQ-LOT-2',
                status: 'AVAILABLE',
                notes: null,
                created_at: new Date('2026-08-01T10:00:00.000Z'),
                updated_at: new Date('2026-08-01T10:00:00.000Z'),
                archived_at: null,
              },
            ],
          });
        }
        if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
          movementQuerySql = sql;
          return Promise.resolve({
            rows: [{ balance: '37.5000' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);
    const batch = await repository.findBatchById(batchId);

    expect(batch).not.toBeNull();
    expect(batch?.currentBalance).toBe(37.5);
    expect(movementQuerySql).toContain("WHEN movement_type = 'ENTRY' THEN quantity");
    expect(movementQuerySql).toContain("WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity");
    expect(movementQuerySql).toContain("WHEN movement_type = 'ADJUSTMENT' THEN quantity");
  });

  it('rejects withdrawal if stock is insufficient based on calculated ledger balance', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              {
                id: batchId,
                laboratory_id: laboratoryId,
                product_id: productId,
                batch_number: 'LOT-2026-003',
                status: 'AVAILABLE',
              },
            ],
          });
        }
        if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
          // Current balance in ledger is 5.0
          return Promise.resolve({ rows: [{ balance: '5.0000' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);

    await expect(
      repository.withdrawStock(
        {
          laboratoryId,
          batchId,
          quantity: 10, // Requesting 10 when only 5 available
          purpose: 'Ensaio clínico',
        },
        context,
      ),
    ).rejects.toThrow(InsufficientStockError);
  });

  it('executes adjustStock inserting signed delta quantity and target balance_after', async () => {
    let movementInsertSql = '';
    let movementInsertParams: unknown[] = [];
    let updatedStatusSql = '';

    const mockClient = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              {
                id: batchId,
                laboratory_id: laboratoryId,
                product_id: productId,
                status: 'AVAILABLE',
              },
            ],
          });
        }
        if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
          // Current ledger balance is 20
          return Promise.resolve({ rows: [{ balance: '20.0000' }] });
        }
        if (sql.includes('INSERT INTO stock_movements')) {
          movementInsertSql = sql;
          movementInsertParams = params ?? [];
          return Promise.resolve({
            rows: [
              {
                id: movementId,
                laboratory_id: laboratoryId,
                batch_id: batchId,
                product_id: productId,
                user_id: actorId,
                project_id: null,
                movement_type: 'ADJUSTMENT',
                quantity: '-5.0000', // delta = 15 - 20 = -5
                balance_after: '15.0000',
                purpose: null,
                reason: 'Ajuste de inventário físico',
                performed_at: new Date('2026-08-24T12:00:00.000Z'),
                created_at: new Date('2026-08-24T12:00:00.000Z'),
              },
            ],
          });
        }
        if (sql.includes('UPDATE batches SET status')) {
          updatedStatusSql = sql;
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO audit_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as DatabasePool;

    const repository = new PostgresInventoryRepository(mockPool);

    const movement = await repository.adjustStock(
      {
        laboratoryId,
        batchId,
        newBalance: 15,
        reason: 'Ajuste de inventário físico',
      },
      context,
    );

    expect(movement.type).toBe('ADJUSTMENT');
    expect(movement.quantity).toBe(-5);
    expect(movement.balanceAfter).toBe(15);
    expect(movementInsertSql).toContain('INSERT INTO stock_movements');
    expect(updatedStatusSql).toContain('UPDATE batches SET status');
    expect(movementInsertParams[4]).toBe(-5); // delta passed to quantity column
    expect(movementInsertParams[5]).toBe(15); // newBalance passed to balance_after column
    expect(movementInsertParams[6]).toBe('Ajuste de inventário físico');
  });
});
