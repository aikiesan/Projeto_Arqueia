import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresManagementRepository } from './postgres-management-repository.js';

describe('PostgresManagementRepository Unit & Contract Tests', () => {
  const labId = '11111111-1111-4111-a111-111111111111';

  it('builds a connected dashboard with bounded set-based queries', async () => {
    const equipmentId = '22222222-2222-4222-a222-222222222222';
    const reservationId = '33333333-3333-4333-a333-333333333333';
    const productId = '44444444-4444-4444-a444-444444444444';
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT timezone FROM laboratories')) return Promise.resolve({ rows: [{ timezone: 'America/Sao_Paulo' }] });
      if (sql.includes('SELECT id, name, status')) return Promise.resolve({ rows: [{ id: equipmentId, name: 'HPLC', status: 'MAINTENANCE' }] });
      if (sql.includes('WITH day_bounds AS')) return Promise.resolve({ rows: [{ id: reservationId, equipment_id: equipmentId, equipment_name: 'HPLC', starts_at: new Date('2026-08-14T12:00:00.000Z'), ends_at: new Date('2026-08-14T13:00:00.000Z'), purpose: 'Análise', status: 'ACTIVE' }] });
      if (sql.includes('WITH batch_balances AS')) return Promise.resolve({ rows: [{ kind: 'LOW_STOCK', product_id: productId, product_name: 'Acetona', batch_id: null, batch_number: null, detail: 'Saldo abaixo do mínimo', priority_order: 3 }] });
      return Promise.resolve({ rows: [] });
    });
    const repository = new PostgresManagementRepository({ query } as unknown as DatabasePool);

    const result = await repository.getDashboardSummary(labId, { equipment: true, scheduling: true, inventory: true, maintenance: true });

    expect(result.equipmentSummary.byStatus.MAINTENANCE).toBe(1);
    expect(result.todayReservations[0]?.status).toBe('CONFIRMED');
    expect(result.inventoryAlerts[0]?.productId).toBe(productId);
    expect(result.upcomingActions[0]?.kind).toBe('EQUIPMENT_ATTENTION');
    expect(result.availability).toEqual({ equipment: true, scheduling: true, inventory: true, maintenance: true, pendingActions: true });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('does not query unauthorized dashboard sections and isolates their data', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ timezone: 'America/Sao_Paulo' }] });
    const repository = new PostgresManagementRepository({ query } as unknown as DatabasePool);

    const result = await repository.getDashboardSummary(labId, { equipment: false, scheduling: false, inventory: false, maintenance: false });

    expect(query).toHaveBeenCalledTimes(1);
    expect(result.todayReservations).toEqual([]);
    expect(result.inventoryAlerts).toEqual([]);
    expect(result.availability).toEqual({ equipment: false, scheduling: false, inventory: false, maintenance: false, pendingActions: false });
  });

  it('keeps successful dashboard sections when the inventory query fails', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT timezone FROM laboratories')) return Promise.resolve({ rows: [{ timezone: 'America/Sao_Paulo' }] });
      if (sql.includes('WITH batch_balances AS')) return Promise.reject(new Error('inventory unavailable'));
      return Promise.resolve({ rows: [] });
    });
    const repository = new PostgresManagementRepository({ query } as unknown as DatabasePool);

    const result = await repository.getDashboardSummary(labId, { equipment: true, scheduling: true, inventory: true, maintenance: true });

    expect(result.availability.equipment).toBe(true);
    expect(result.availability.scheduling).toBe(true);
    expect(result.availability.inventory).toBe(false);
  });

  it('queries analytics with laboratory timezone and correct set-based SQL queries', async () => {
    const mockPool: DatabasePool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT timezone FROM laboratories')) {
          return Promise.resolve({ rows: [{ timezone: 'America/Sao_Paulo' }] });
        }
        if (sql.includes('FROM equipment WHERE')) {
          return Promise.resolve({ rows: [{ count: '5' }] });
        }
        if (sql.includes('FROM equipment_occupations')) {
          return Promise.resolve({ rows: [{ hours: '42.5', cnt: '10' }] });
        }
        if (sql.includes('FROM batches b')) {
          return Promise.resolve({ rows: [{ count: '3' }] });
        }
        if (sql.includes('FROM products p')) {
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('FROM stock_movements')) {
          return Promise.resolve({ rows: [{ count: '7' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresManagementRepository(mockPool);

    const result = await repository.getAnalytics({
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
    });

    expect(result.laboratoryId).toBe(labId);
    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.equipmentMetrics.totalActiveEquipment).toBe(5);
    expect(result.equipmentMetrics.totalReservedHours).toBe(42.5);
    expect(result.equipmentMetrics.reservationCount).toBe(10);
  });

  it('sanitizes audit detail payloads fail-closed omitting unknown or sensitive fields', async () => {
    const auditId = '77777777-7777-4777-a777-777777777777';
    const mockPool: DatabasePool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: auditId,
            occurred_at: new Date('2026-08-14T12:00:00.000Z'),
            actor_id: null,
            actor_name: null,
            action: 'inventory.product.created',
            entity: 'Product',
            entity_id: 'p1',
            laboratory_id: labId,
            origin: 'api:test',
            before: null,
            after: {
              id: 'p1',
              code: 'ACT-PA',
              name: 'Acetona PA',
              unitOfMeasure: 'ML',
              password: 'super-secret-password',
              unknownField: 'should-be-omitted',
            },
          },
        ],
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresManagementRepository(mockPool);
    const detail = await repository.getAuditLogDetail(auditId, labId);

    expect(detail).not.toBeNull();
    expect(detail?.actorName).toBe('Sistema');
    expect(detail?.after).toHaveProperty('code', 'ACT-PA');
    expect(detail?.after).not.toHaveProperty('password');
    expect(detail?.after).not.toHaveProperty('unknownField');
    expect(detail?.redactedFields).toContain('password');
    expect(detail?.redactedFields).toContain('unknownField');
  });

  it('queries project usage via set-based SQL without N+1 iterations', async () => {
    const projId = '22222222-2222-4222-a222-222222222222';
    const prodId = '33333333-3333-4333-a333-333333333333';

    const mockPool: DatabasePool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('WITH project_list AS')) {
          return Promise.resolve({
            rows: [
              {
                project_id: projId,
                project_code: 'PROJ-01',
                project_name: 'Projeto Síntese Orgânica',
                reserved_hours: '30.0',
                reservation_count: '8',
                withdrawal_count: '4',
              },
            ],
          });
        }
        if (sql.includes('FROM stock_movements sm')) {
          return Promise.resolve({
            rows: [
              {
                project_id: projId,
                product_id: prodId,
                product_code: 'ACT-PA',
                product_name: 'Acetona PA',
                unit_of_measure: 'ML',
                total_quantity: '2000',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as DatabasePool;

    const repository = new PostgresManagementRepository(mockPool);
    const result = await repository.getProjectUsage({
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-14T23:59:59.000Z',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.projectId).toBe(projId);
    expect(result.items[0]?.projectName).toBe('Projeto Síntese Orgânica');
    expect(result.items[0]?.reservedHours).toBe(30);
    expect(result.items[0]?.consumedProducts).toHaveLength(1);
    expect(result.items[0]?.consumedProducts[0]?.productId).toBe(prodId);
    expect(result.items[0]?.consumedProducts[0]?.productName).toBe('Acetona PA');
  });
});
