import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient, DatabasePool } from '@arqueia/database';
import type { WithdrawStockInput } from '@arqueia/contracts';

import { PostgresSchedulingRepository } from './infrastructure/postgres-scheduling-repository.js';
import { PostgresInventoryRepository } from '../inventory/infrastructure/postgres-inventory-repository.js';
import { ReservationConflictError } from './domain/scheduling.errors.js';
import { InsufficientStockError } from '../inventory/domain/inventory.errors.js';
import { SchedulingExceptionFilter } from './interface/scheduling-exception.filter.js';

describe('Concurrency & Integrity Empirical Challenge Suite (M3 & M4)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const machineAId = '22222222-2222-4222-a222-222222222222';
  const machineBId = '33333333-3333-4333-a333-333333333333';
  const userId = '44444444-4444-4444-a444-444444444444';
  const projectId = '55555555-5555-4555-a555-555555555555';
  const batchId = '66666666-6666-4666-a666-666666666666';
  const productId = '77777777-7777-4777-a777-777777777777';

  const mutationContext = {
    actorId: userId,
    origin: 'challenge:concurrency',
    requestId: 'req-concurrency-challenge',
  };

  function captureFilterResponse(
    filter: { catch: (err: Error, host: unknown) => void },
    error: Error,
  ) {
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

  describe('1. PostgreSQL btree_gist Exclusion Constraints & Booking Concurrency', () => {
    const schedulingFilter = new SchedulingExceptionFilter();

    it('simultaneous bookings on DIFFERENT machines at the exact same hour must BOTH SUCCEED without collision', async () => {
      const occupations: Array<{
        id: string;
        equipment_id: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }> = [];

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
          if (sql.includes('SELECT id, status, max_reservation_minutes')) {
            return Promise.resolve({
              rows: [
                {
                  id: params[0],
                  status: 'AVAILABLE',
                  max_reservation_minutes: 720,
                  requires_training: false,
                  requires_approval: false,
                  absence_release_minutes: 30,
                },
              ],
            });
          }
          if (sql.includes('SELECT id FROM projects')) {
            return Promise.resolve({ rows: [{ id: projectId }] });
          }
          if (sql.includes('INSERT INTO equipment_occupations')) {
            const [pLab, pEq, pStarts, pEnds] = params as [string, string, string, string];
            // Simulate PostgreSQL btree_gist exclusion check:
            // EXCLUDE USING gist (equipment_id WITH =, period WITH &&) WHERE status NOT IN ('CANCELLED', 'RELEASED_ABSENCE')
            const hasConflict = occupations.some((occ) => {
              if (occ.equipment_id !== pEq) return false; // Different machine -> NO CONFLICT
              if (occ.status === 'CANCELLED' || occ.status === 'RELEASED_ABSENCE') return false;
              const occStart = new Date(occ.starts_at).getTime();
              const occEnd = new Date(occ.ends_at).getTime();
              const reqStart = new Date(pStarts).getTime();
              const reqEnd = new Date(pEnds).getTime();
              return reqStart < occEnd && reqEnd > occStart; // Overlapping range [start, end)
            });

            if (hasConflict) {
              const err = new Error('conflicting key value violates exclusion constraint "equipment_occupations_no_overlap_excl"');
              (err as { code?: string }).code = '23P01';
              return Promise.reject(err);
            }

            const occId = randomUUID();
            occupations.push({
              id: occId,
              equipment_id: pEq,
              starts_at: pStarts,
              ends_at: pEnds,
              status: 'CONFIRMED',
            });

            return Promise.resolve({
              rows: [
                {
                  id: occId,
                  laboratory_id: pLab,
                  equipment_id: pEq,
                  occupation_type: 'RESERVATION',
                  starts_at: new Date(pStarts),
                  ends_at: new Date(pEnds),
                  status: 'CONFIRMED',
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                },
              ],
            });
          }
          if (sql.includes('INSERT INTO reservations')) {
            return Promise.resolve({
              rows: [
                {
                  id: params[0],
                  laboratory_id: params[1],
                  equipment_id: params[2],
                  user_id: params[3],
                  project_id: params[4],
                  purpose: params[5],
                  sample_count: params[6],
                  notes: params[7],
                  started_at: null,
                  completed_at: null,
                  cancelled_at: null,
                  cancelled_by_user_id: null,
                  cancellation_reason: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                },
              ],
            });
          }
          if (sql.includes('INSERT INTO audit_events')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      } as unknown as DatabaseClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as unknown as DatabasePool;

      const repo = new PostgresSchedulingRepository(mockPool);

      const startsAt = '2026-08-25T13:00:00.000Z'; // 10:00 America/Sao_Paulo
      const endsAt = '2026-08-25T17:00:00.000Z';   // 14:00 America/Sao_Paulo (4h)

      // Simultaneous bookings for Machine A (HPLC) and Machine B (MS)
      const resA = await repo.createReservation(
        {
          laboratoryId: labId,
          equipmentId: machineAId,
          projectId,
          startsAt,
          endsAt,
          purpose: 'Simultaneous HPLC Analysis',
        },
        mutationContext,
      );

      const resB = await repo.createReservation(
        {
          laboratoryId: labId,
          equipmentId: machineBId,
          projectId,
          startsAt,
          endsAt,
          purpose: 'Simultaneous MS Analysis',
        },
        mutationContext,
      );

      expect(resA.createdReservations).toHaveLength(1);
      expect(resA.conflictingSlots).toHaveLength(0);
      expect(resB.createdReservations).toHaveLength(1);
      expect(resB.conflictingSlots).toHaveLength(0);
      expect(occupations).toHaveLength(2);
      expect(occupations[0]?.equipment_id).toBe(machineAId);
      expect(occupations[1]?.equipment_id).toBe(machineBId);
    });

    it('overlapping bookings on the SAME machine must trigger PostgreSQL 23P01 exclusion violation and yield HTTP 409 Conflict', async () => {
      const occupations: Array<{
        id: string;
        equipment_id: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }> = [
        {
          id: 'existing-occ-1',
          equipment_id: machineAId,
          starts_at: '2026-08-25T13:00:00.000Z',
          ends_at: '2026-08-25T17:00:00.000Z',
          status: 'CONFIRMED',
        },
      ];

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
          if (sql.includes('SELECT id, status, max_reservation_minutes')) {
            return Promise.resolve({
              rows: [
                {
                  id: machineAId,
                  status: 'AVAILABLE',
                  max_reservation_minutes: 720,
                  requires_training: false,
                  requires_approval: false,
                  absence_release_minutes: 30,
                },
              ],
            });
          }
          if (sql.includes('SELECT id FROM projects')) {
            return Promise.resolve({ rows: [{ id: projectId }] });
          }
          if (sql.includes('INSERT INTO equipment_occupations')) {
            const [, pEq, pStarts, pEnds] = params as [string, string, string, string];
            const hasConflict = occupations.some((occ) => {
              if (occ.equipment_id !== pEq) return false;
              if (occ.status === 'CANCELLED' || occ.status === 'RELEASED_ABSENCE') return false;
              const occStart = new Date(occ.starts_at).getTime();
              const occEnd = new Date(occ.ends_at).getTime();
              const reqStart = new Date(pStarts).getTime();
              const reqEnd = new Date(pEnds).getTime();
              return reqStart < occEnd && reqEnd > occStart;
            });

            if (hasConflict) {
              const err = new Error('conflicting key value violates exclusion constraint "equipment_occupations_no_overlap_excl"');
              (err as { code?: string }).code = '23P01';
              return Promise.reject(err);
            }
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      } as unknown as DatabaseClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as unknown as DatabasePool;

      const repo = new PostgresSchedulingRepository(mockPool);

      // Attempt overlapping booking on Machine A (14:00 to 16:00, overlapping with existing 13:00 to 17:00)
      let error: unknown = null;
      try {
        await repo.createReservation(
          {
            laboratoryId: labId,
            equipmentId: machineAId,
            projectId,
            startsAt: '2026-08-25T14:00:00.000Z',
            endsAt: '2026-08-25T16:00:00.000Z',
            purpose: 'Conflicting reservation attempt',
          },
          mutationContext,
        );
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ReservationConflictError);
      const conflictErr = error as ReservationConflictError;
      expect(conflictErr.code).toBe('RESERVATION_SLOT_CONFLICT');

      // Verify SchedulingExceptionFilter turns this into HTTP 409 Conflict
      const httpResponse = captureFilterResponse(schedulingFilter, conflictErr);
      expect(httpResponse.statusCode).toBe(409);
      expect(httpResponse.body).toEqual({
        code: 'RESERVATION_SLOT_CONFLICT',
        message: conflictErr.message,
        requestedSlot: {
          startsAt: '2026-08-25T14:00:00.000Z',
          endsAt: '2026-08-25T16:00:00.000Z',
        },
      });
    });

    it('adjacent / contiguous bookings [09:00, 10:00) and [10:00, 11:00) on the SAME machine must NOT overlap and BOTH SUCCEED', async () => {
      const occupations: Array<{
        id: string;
        equipment_id: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }> = [
        {
          id: 'slot-1',
          equipment_id: machineAId,
          starts_at: '2026-08-25T09:00:00.000Z',
          ends_at: '2026-08-25T10:00:00.000Z',
          status: 'CONFIRMED',
        },
      ];

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
          if (sql.includes('SELECT id, status, max_reservation_minutes')) {
            return Promise.resolve({
              rows: [
                {
                  id: machineAId,
                  status: 'AVAILABLE',
                  max_reservation_minutes: 720,
                  requires_training: false,
                  requires_approval: false,
                  absence_release_minutes: 30,
                },
              ],
            });
          }
          if (sql.includes('SELECT id FROM projects')) {
            return Promise.resolve({ rows: [{ id: projectId }] });
          }
          if (sql.includes('INSERT INTO equipment_occupations')) {
            const [pLab, pEq, pStarts, pEnds] = params as [string, string, string, string];
            // In PostgreSQL tstzrange(starts_at, ends_at, '[)'), [09:00, 10:00) and [10:00, 11:00) do NOT overlap (&& is false)
            const hasConflict = occupations.some((occ) => {
              if (occ.equipment_id !== pEq) return false;
              if (occ.status === 'CANCELLED' || occ.status === 'RELEASED_ABSENCE') return false;
              const occStart = new Date(occ.starts_at).getTime();
              const occEnd = new Date(occ.ends_at).getTime();
              const reqStart = new Date(pStarts).getTime();
              const reqEnd = new Date(pEnds).getTime();
              return reqStart < occEnd && reqEnd > occStart;
            });

            if (hasConflict) {
              const err = new Error('exclusion violation');
              (err as { code?: string }).code = '23P01';
              return Promise.reject(err);
            }

            const occId = randomUUID();
            occupations.push({
              id: occId,
              equipment_id: pEq,
              starts_at: pStarts,
              ends_at: pEnds,
              status: 'CONFIRMED',
            });

            return Promise.resolve({
              rows: [
                {
                  id: occId,
                  laboratory_id: pLab,
                  equipment_id: pEq,
                  occupation_type: 'RESERVATION',
                  starts_at: new Date(pStarts),
                  ends_at: new Date(pEnds),
                  status: 'CONFIRMED',
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                },
              ],
            });
          }
          if (sql.includes('INSERT INTO reservations')) {
            return Promise.resolve({
              rows: [
                {
                  id: params[0],
                  laboratory_id: params[1],
                  equipment_id: params[2],
                  user_id: params[3],
                  project_id: params[4],
                  purpose: params[5],
                  sample_count: null,
                  notes: null,
                  started_at: null,
                  completed_at: null,
                  cancelled_at: null,
                  cancelled_by_user_id: null,
                  cancellation_reason: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                  archived_at: null,
                },
              ],
            });
          }
          if (sql.includes('INSERT INTO audit_events')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      } as unknown as DatabaseClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as unknown as DatabasePool;

      const repo = new PostgresSchedulingRepository(mockPool);

      // Book back-to-back immediately after 10:00
      const resAdjacent = await repo.createReservation(
        {
          laboratoryId: labId,
          equipmentId: machineAId,
          projectId,
          startsAt: '2026-08-25T10:00:00.000Z',
          endsAt: '2026-08-25T11:00:00.000Z',
          purpose: 'Back to back session',
        },
        mutationContext,
      );

      expect(resAdjacent.createdReservations).toHaveLength(1);
      expect(occupations).toHaveLength(2);
    });
  });

  describe('2. Concurrent Stock Withdrawals & Row-Level Lock (FOR UPDATE) Race Condition Challenge', () => {
    it('under concurrent race condition on the same batch, serializes withdrawals and prevents negative balance or stock overdraw', async () => {
      const currentLedgerMovements: Array<{
        movement_type: string;
        quantity: number;
        balance_after: number;
      }> = [
        { movement_type: 'ENTRY', quantity: 10.0, balance_after: 10.0 }, // Initial stock = 10.0
      ];

      let isLocked = false;
      const lockQueue: Array<() => void> = [];

      async function acquireRowLock(): Promise<void> {
        if (!isLocked) {
          isLocked = true;
          return;
        }
        return new Promise<void>((resolve) => {
          lockQueue.push(resolve);
        });
      }

      function releaseRowLock(): void {
        if (lockQueue.length > 0) {
          const next = lockQueue.shift();
          next?.();
        } else {
          isLocked = false;
        }
      }

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
          if (sql.includes('SELECT id, laboratory_id, product_id, batch_number, status FROM batches') && sql.includes('FOR UPDATE')) {
            await acquireRowLock();
            return {
              rows: [
                {
                  id: batchId,
                  laboratory_id: labId,
                  product_id: productId,
                  batch_number: 'LOT-RACE-01',
                  status: 'AVAILABLE',
                },
              ],
            };
          }

          if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
            // Calculate derived sum
            const sum = currentLedgerMovements.reduce((acc, mov) => {
              if (mov.movement_type === 'ENTRY') return acc + mov.quantity;
              if (mov.movement_type === 'WITHDRAWAL' || mov.movement_type === 'DISCARD') return acc - mov.quantity;
              if (mov.movement_type === 'ADJUSTMENT') return acc + mov.quantity;
              return acc;
            }, 0);
            return { rows: [{ balance: sum }] };
          }

          if (sql.includes('INSERT INTO stock_movements')) {
            const pQty = Number(params[5]);
            const pBalAfter = Number(params[6]);
            if (pBalAfter < 0) {
              const err = new Error('new row for relation "stock_movements" violates check constraint "stock_movements_balance_after_non_negative_check"');
              (err as { code?: string }).code = '23514';
              throw err;
            }
            currentLedgerMovements.push({
              movement_type: 'WITHDRAWAL',
              quantity: pQty,
              balance_after: pBalAfter,
            });
            return {
              rows: [
                {
                  id: randomUUID(),
                  laboratory_id: labId,
                  batch_id: batchId,
                  product_id: productId,
                  user_id: userId,
                  project_id: projectId,
                  movement_type: 'WITHDRAWAL',
                  quantity: pQty,
                  balance_after: pBalAfter,
                  purpose: 'Withdrawal',
                  reason: null,
                  performed_at: new Date(),
                  created_at: new Date(),
                },
              ],
            };
          }

          if (sql.includes('UPDATE batches SET status =') || sql.includes('INSERT INTO audit_events')) {
            return { rows: [] };
          }

          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as DatabaseClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as unknown as DatabasePool;

      const repo = new PostgresInventoryRepository(mockPool);

      // Wrapper that simulates inTransaction releasing the FOR UPDATE lock on commit or rollback
      const withdrawWithLockRelease = async (input: WithdrawStockInput) => {
        try {
          return await repo.withdrawStock(input, {
            actorId: userId,
            origin: 'race:test',
            requestId: 'req-1',
          });
        } finally {
          releaseRowLock();
        }
      };

      // Scenario: Stock is 10.0. Request 1 wants 7.0, Request 2 wants 6.0 concurrently.
      // Total requested = 13.0 > 10.0.
      // Exactly ONE request must succeed; the other must throw InsufficientStockError.
      const results = await Promise.allSettled([
        withdrawWithLockRelease({
          laboratoryId: labId,
          batchId,
          projectId,
          quantity: 7.0,
          purpose: 'Concurrent Request 1 (7.0 units)',
        }),
        withdrawWithLockRelease({
          laboratoryId: labId,
          batchId,
          projectId,
          quantity: 6.0,
          purpose: 'Concurrent Request 2 (6.0 units)',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedReason).toBeInstanceOf(InsufficientStockError);

      // Final ledger balance verification
      const finalDerivedBalance = currentLedgerMovements.reduce((acc, mov) => {
        if (mov.movement_type === 'ENTRY') return acc + mov.quantity;
        if (mov.movement_type === 'WITHDRAWAL') return acc - mov.quantity;
        return acc;
      }, 0);

      // Either 10 - 7 = 3 or 10 - 6 = 4, but NEVER negative
      expect(finalDerivedBalance).toBeGreaterThanOrEqual(0);
      expect([3.0, 4.0]).toContain(finalDerivedBalance);
      expect(currentLedgerMovements.every((mov) => mov.balance_after >= 0)).toBe(true);
    });

    it('5 parallel concurrent requests of 3.0 units on stock of 10.0: exactly 3 succeed (balance 1.0) and 2 fail', async () => {
      const currentLedgerMovements: Array<{
        movement_type: string;
        quantity: number;
        balance_after: number;
      }> = [
        { movement_type: 'ENTRY', quantity: 10.0, balance_after: 10.0 },
      ];

      let isLocked = false;
      const lockQueue: Array<() => void> = [];

      async function acquireRowLock(): Promise<void> {
        if (!isLocked) {
          isLocked = true;
          return;
        }
        return new Promise<void>((resolve) => {
          lockQueue.push(resolve);
        });
      }

      function releaseRowLock(): void {
        if (lockQueue.length > 0) {
          const next = lockQueue.shift();
          next?.();
        } else {
          isLocked = false;
        }
      }

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
          if (sql.includes('SELECT id, laboratory_id, product_id, batch_number, status FROM batches') && sql.includes('FOR UPDATE')) {
            await acquireRowLock();
            return {
              rows: [
                {
                  id: batchId,
                  laboratory_id: labId,
                  product_id: productId,
                  batch_number: 'LOT-RACE-02',
                  status: 'AVAILABLE',
                },
              ],
            };
          }

          if (sql.includes('FROM stock_movements') && sql.includes('WHERE batch_id = $1')) {
            const sum = currentLedgerMovements.reduce((acc, mov) => {
              if (mov.movement_type === 'ENTRY') return acc + mov.quantity;
              if (mov.movement_type === 'WITHDRAWAL') return acc - mov.quantity;
              return acc;
            }, 0);
            return { rows: [{ balance: sum }] };
          }

          if (sql.includes('INSERT INTO stock_movements')) {
            const pQty = Number(params[5]);
            const pBalAfter = Number(params[6]);
            if (pBalAfter < 0) {
              const err = new Error('stock_movements_balance_after_non_negative_check violation');
              (err as { code?: string }).code = '23514';
              throw err;
            }
            currentLedgerMovements.push({
              movement_type: 'WITHDRAWAL',
              quantity: pQty,
              balance_after: pBalAfter,
            });
            return {
              rows: [
                {
                  id: randomUUID(),
                  laboratory_id: labId,
                  batch_id: batchId,
                  product_id: productId,
                  user_id: userId,
                  project_id: projectId,
                  movement_type: 'WITHDRAWAL',
                  quantity: pQty,
                  balance_after: pBalAfter,
                  purpose: 'Withdrawal',
                  reason: null,
                  performed_at: new Date(),
                  created_at: new Date(),
                },
              ],
            };
          }

          if (sql.includes('UPDATE batches SET status =') || sql.includes('INSERT INTO audit_events')) {
            return { rows: [] };
          }

          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as DatabaseClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: mockClient.query,
      } as unknown as DatabasePool;

      const repo = new PostgresInventoryRepository(mockPool);

      const withdrawWithLockRelease = async (qty: number) => {
        try {
          return await repo.withdrawStock(
            {
              laboratoryId: labId,
              batchId,
              projectId,
              quantity: qty,
              purpose: `Parallel withdrawal of ${qty}`,
            },
            {
              actorId: userId,
              origin: 'race:parallel',
              requestId: randomUUID(),
            },
          );
        } finally {
          releaseRowLock();
        }
      };

      const promises = [
        withdrawWithLockRelease(3.0),
        withdrawWithLockRelease(3.0),
        withdrawWithLockRelease(3.0),
        withdrawWithLockRelease(3.0),
        withdrawWithLockRelease(3.0),
      ];

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(3); // 3 * 3.0 = 9.0 <= 10.0
      expect(rejected).toHaveLength(2);  // 4th and 5th attempt need 3.0 but only 1.0 left -> rejected

      for (const rej of rejected) {
        expect((rej as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);
      }

      const finalBalance = currentLedgerMovements.reduce((acc, mov) => {
        if (mov.movement_type === 'ENTRY') return acc + mov.quantity;
        if (mov.movement_type === 'WITHDRAWAL') return acc - mov.quantity;
        return acc;
      }, 0);

      expect(finalBalance).toBe(1.0);
      expect(currentLedgerMovements).toHaveLength(4); // 1 initial ENTRY + 3 WITHDRAWAL
    });
  });
});
