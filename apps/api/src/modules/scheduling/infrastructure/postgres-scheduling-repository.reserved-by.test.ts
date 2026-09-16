import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import type { SchedulingAccess } from '../domain/ports/scheduling-repository.port.js';
import { PostgresSchedulingRepository } from './postgres-scheduling-repository.js';

/**
 * A agenda interna precisa dizer, na própria grade, de quem é cada reserva —
 * era a informação que faltava para resolver disputa de horário no balcão.
 * O nome já é público na agenda sem login (`publicScheduleItemSchema`), então
 * o que se cobre aqui é a propagação do `users.name` até `ScheduleItem`.
 */
describe('PostgresSchedulingRepository.listSchedule — nome de quem reservou', () => {
  const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
  const equipmentId = '22222222-2222-4222-a222-222222222222';
  const reservationId = '11111111-1111-4111-a111-111111111111';
  const blockId = '66666666-6666-4666-a666-666666666666';
  const ownerId = '33333333-3333-4333-a333-333333333333';
  const otherUserId = '99999999-9999-4999-a999-999999999999';

  const access: SchedulingAccess = {
    canCancelOwn: true,
    canManageBlocks: true,
    canManageReservations: false,
    canReserve: true,
    canViewPrivateReservations: false,
  };

  const reservationRow = {
    id: reservationId,
    laboratory_id: laboratoryId,
    equipment_id: equipmentId,
    equipment_name: 'Espectrômetro de Massa',
    occupation_type: 'RESERVATION',
    starts_at: new Date('2026-08-14T13:00:00.000Z'),
    ends_at: new Date('2026-08-14T15:00:00.000Z'),
    status: 'CONFIRMED',
    user_id: ownerId,
    reserved_by: 'Marina Duarte',
    project_id: null,
    project_label: null,
    project_code: null,
    purpose: 'Identificação de peptídeos',
    sample_count: null,
    notes: null,
    started_at: null,
    completed_at: null,
    created_by_user_id: null,
    block_reason: null,
    description: null,
  };

  const blockRow = {
    ...reservationRow,
    id: blockId,
    occupation_type: 'TECHNICAL_BLOCK',
    status: 'ACTIVE',
    user_id: null,
    reserved_by: null,
    purpose: null,
    created_by_user_id: ownerId,
    block_reason: 'MAINTENANCE',
    description: 'Troca de filamentos da fonte de ionização.',
  };

  function poolReturning(rows: readonly unknown[]): {
    pool: DatabasePool;
    query: ReturnType<typeof vi.fn>;
  } {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ timezone: 'America/Sao_Paulo' }] })
      .mockResolvedValueOnce({ rows });
    return { pool: { query } as unknown as DatabasePool, query };
  }

  const listQuery = {
    laboratoryId,
    startsAt: '2026-08-14T00:00:00.000Z',
    endsAt: '2026-08-15T00:00:00.000Z',
    onlyMine: false,
    includeCancelled: false,
  } as const;

  it('busca o nome do reservante no cadastro de usuários', async () => {
    const { pool, query } = poolReturning([reservationRow]);

    await new PostgresSchedulingRepository(pool).listSchedule(listQuery, otherUserId, access);

    const [sql] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('LEFT JOIN users ru ON ru.id = r.user_id');
    expect(sql).toContain('ru.name AS reserved_by');
  });

  it('expõe reservedBy mesmo para quem não enxerga os detalhes da reserva', async () => {
    const { pool } = poolReturning([reservationRow]);

    const response = await new PostgresSchedulingRepository(pool).listSchedule(
      listQuery,
      otherUserId,
      access,
    );

    const item = response.items[0]!;
    // Sem `canViewPrivateReservations` o título é genérico, mas o nome aparece.
    expect(item.title).toBe('Equipamento Reservado');
    expect(item.reservationDetails).toBeNull();
    expect(item.reservedBy).toBe('Marina Duarte');
  });

  it('deixa reservedBy nulo em bloqueio técnico', async () => {
    const { pool } = poolReturning([blockRow]);

    const response = await new PostgresSchedulingRepository(pool).listSchedule(
      listQuery,
      otherUserId,
      access,
    );

    expect(response.items[0]!.type).toBe('TECHNICAL_BLOCK');
    expect(response.items[0]!.reservedBy).toBeNull();
  });
});
