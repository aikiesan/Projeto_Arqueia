import { createDatabasePool, type DatabasePool } from '@arqueia/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EquipmentTrainingRequiredError,
  InvalidReservationProjectError,
  ReservationConflictError,
  ReservationApprovalRequiredError,
  ReservationNotFoundError,
} from '../domain/scheduling.errors.js';
import { PostgresSchedulingRepository } from './postgres-scheduling-repository.js';

const databaseUrl = process.env.DATABASE_URL;
const laboratoryBId = 'a0000000-0000-4000-8000-000000000001';
const projectBId = 'a0000000-0000-4000-8000-000000000002';
const equipmentAId = 'a0000000-0000-4000-8000-000000000003';
const equipmentBId = 'a0000000-0000-4000-8000-000000000004';
const fixtureEquipmentIds = [equipmentAId, equipmentBId];
const integrationOrigin = 'api:integration:scheduling';

interface SeedScope {
  laboratory_id: string;
  institution_id: string;
  project_id: string;
  user_id: string;
  catalog_option_id: string;
}

describe.skipIf(databaseUrl === undefined)('PostgresSchedulingRepository integration', () => {
  let pool: DatabasePool;
  let repository: PostgresSchedulingRepository;
  let seed: SeedScope;
  let baselineReservationId: string;

  const context = () => ({
    actorId: seed.user_id,
    origin: integrationOrigin,
    requestId: null,
  });

  async function cleanFixtures(): Promise<void> {
    await pool.query(`DELETE FROM reservations WHERE equipment_id = ANY($1::uuid[])`, [
      fixtureEquipmentIds,
    ]);
    await pool.query(`DELETE FROM technical_blocks WHERE equipment_id = ANY($1::uuid[])`, [
      fixtureEquipmentIds,
    ]);
    await pool.query(`DELETE FROM equipment_occupations WHERE equipment_id = ANY($1::uuid[])`, [
      fixtureEquipmentIds,
    ]);
    await pool.query(`DELETE FROM equipment WHERE id = ANY($1::uuid[])`, [fixtureEquipmentIds]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectBId]);
    await pool.query(`DELETE FROM laboratories WHERE id = $1`, [laboratoryBId]);
  }

  beforeAll(async () => {
    pool = createDatabasePool({ connectionString: databaseUrl!, maxConnections: 8 });
    repository = new PostgresSchedulingRepository(pool);

    const seedResult = await pool.query<SeedScope>(
      `SELECT l.id AS laboratory_id,
              l.institution_id,
              p.id AS project_id,
              u.id AS user_id,
              co.id AS catalog_option_id
         FROM laboratories l
         JOIN projects p
           ON p.laboratory_id = l.id
          AND p.status = 'ACTIVE'
          AND p.archived_at IS NULL
         JOIN institutions i ON i.id = l.institution_id
         JOIN users u
           ON u.institution_id = i.id
          AND u.status = 'ACTIVE'
          AND u.archived_at IS NULL
         JOIN catalog_options co
           ON co.laboratory_id = l.id
          AND co.kind IN ('EQUIPMENT_TYPE', 'EQUIPMENT_MODEL')
          AND co.is_selectable IS TRUE
          AND co.archived_at IS NULL
        WHERE l.code = 'CP2b'
          AND l.archived_at IS NULL
        ORDER BY p.id, u.id, co.id
        LIMIT 1`,
    );
    seed = seedResult.rows[0]!;
    if (!seed) throw new Error('O seed CP2b é necessário para o teste de integração.');

    await cleanFixtures();
    await pool.query(
      `INSERT INTO laboratories (id, institution_id, name, code, timezone)
       VALUES ($1, $2, 'Laboratório de isolamento B', 'SCHED-B', 'UTC')`,
      [laboratoryBId, seed.institution_id],
    );
    await pool.query(
      `INSERT INTO projects (id, laboratory_id, code, name, status)
       VALUES ($1, $2, 'SCHED-B-PROJECT', 'Projeto do laboratório B', 'ACTIVE')`,
      [projectBId, laboratoryBId],
    );
    await pool.query(
      `INSERT INTO equipment (
         id, laboratory_id, catalog_option_id, code, name, status,
         max_reservation_minutes, requires_training, requires_approval,
         absence_release_minutes
       ) VALUES
         ($1, $3, $4, 'SCHED-INT-A', 'Equipamento integração A', 'AVAILABLE', 720, false, false, 30),
         ($2, $3, $4, 'SCHED-INT-B', 'Equipamento integração B', 'AVAILABLE', 720, false, false, 30)`,
      [equipmentAId, equipmentBId, seed.laboratory_id, seed.catalog_option_id],
    );

    const baseline = await repository.createReservation(
      {
        laboratoryId: seed.laboratory_id,
        equipmentId: equipmentAId,
        projectId: seed.project_id,
        startsAt: '2031-01-05T12:00:00.000Z',
        endsAt: '2031-01-05T13:00:00.000Z',
        purpose: 'Reserva base para isolamento',
      },
      context(),
    );
    baselineReservationId = baseline.createdReservations[0]!.id;
  });

  afterAll(async () => {
    if (pool) {
      await cleanFixtures();
      await pool.end();
    }
  });

  it('allows exactly one of two concurrent reservations for the same equipment and range', async () => {
    const input = {
      laboratoryId: seed.laboratory_id,
      equipmentId: equipmentAId,
      projectId: seed.project_id,
      startsAt: '2031-01-10T12:00:00.000Z',
      endsAt: '2031-01-10T13:00:00.000Z',
      purpose: 'Teste concorrente reserva × reserva',
    };

    const results = await Promise.allSettled([
      repository.createReservation(input, context()),
      repository.createReservation(input, context()),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({ reason: expect.any(ReservationConflictError) });

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)
         FROM equipment_occupations
        WHERE equipment_id = $1
          AND starts_at = $2
          AND status != 'CANCELLED'`,
      [equipmentAId, input.startsAt],
    );
    expect(Number(count.rows[0]?.count)).toBe(1);
  });

  it('resolves reservation versus technical block concurrency in the database', async () => {
    const startsAt = '2031-01-11T12:00:00.000Z';
    const endsAt = '2031-01-11T14:00:00.000Z';
    const results = await Promise.allSettled([
      repository.createReservation(
        {
          laboratoryId: seed.laboratory_id,
          equipmentId: equipmentBId,
          projectId: seed.project_id,
          startsAt,
          endsAt,
          purpose: 'Teste concorrente reserva × bloqueio',
        },
        context(),
      ),
      repository.createTechnicalBlock(
        {
          laboratoryId: seed.laboratory_id,
          equipmentId: equipmentBId,
          reason: 'MAINTENANCE',
          description: 'Bloqueio concorrente de integração',
          startsAt,
          endsAt,
        },
        context(),
      ),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
  });

  it('rejects a project from another laboratory before creating an occupation', async () => {
    await expect(
      repository.createReservation(
        {
          laboratoryId: seed.laboratory_id,
          equipmentId: equipmentAId,
          projectId: projectBId,
          startsAt: '2031-01-12T12:00:00.000Z',
          endsAt: '2031-01-12T13:00:00.000Z',
          purpose: 'Projeto cruzado inválido',
        },
        context(),
      ),
    ).rejects.toBeInstanceOf(InvalidReservationProjectError);
  });

  it('fails closed while training and approval workflows are not modeled', async () => {
    await pool.query(`UPDATE equipment SET requires_training = true WHERE id = $1`, [equipmentAId]);
    await expect(
      repository.createReservation(
        {
          laboratoryId: seed.laboratory_id,
          equipmentId: equipmentAId,
          projectId: seed.project_id,
          startsAt: '2031-01-13T12:00:00.000Z',
          endsAt: '2031-01-13T13:00:00.000Z',
          purpose: 'Treinamento obrigatório',
        },
        context(),
      ),
    ).rejects.toBeInstanceOf(EquipmentTrainingRequiredError);

    await pool.query(
      `UPDATE equipment
          SET requires_training = false,
              requires_approval = true
        WHERE id = $1`,
      [equipmentAId],
    );
    await expect(
      repository.createReservation(
        {
          laboratoryId: seed.laboratory_id,
          equipmentId: equipmentAId,
          projectId: seed.project_id,
          startsAt: '2031-01-14T12:00:00.000Z',
          endsAt: '2031-01-14T13:00:00.000Z',
          purpose: 'Aprovação obrigatória',
        },
        context(),
      ),
    ).rejects.toBeInstanceOf(ReservationApprovalRequiredError);

    await pool.query(`UPDATE equipment SET requires_approval = false WHERE id = $1`, [equipmentAId]);
  });

  it('does not find a reservation when cancellation uses another laboratory scope', async () => {
    await expect(
      repository.cancelReservation(
        laboratoryBId,
        baselineReservationId,
        'Tentativa cruzada',
        context(),
        true,
      ),
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });

  it('isolates list results and returns the selected laboratory timezone', async () => {
    const access = {
      canCancelOwn: true,
      canManageBlocks: false,
      canManageReservations: false,
      canReserve: true,
      canViewPrivateReservations: false,
    };
    const resultA = await repository.listSchedule(
      {
        laboratoryId: seed.laboratory_id,
        startsAt: '2031-01-01T00:00:00.000Z',
        endsAt: '2031-02-01T00:00:00.000Z',
        onlyMine: false,
        includeCancelled: false,
      },
      seed.user_id,
      access,
    );
    const resultB = await repository.listSchedule(
      {
        laboratoryId: laboratoryBId,
        startsAt: '2031-01-01T00:00:00.000Z',
        endsAt: '2031-02-01T00:00:00.000Z',
        onlyMine: false,
        includeCancelled: false,
      },
      seed.user_id,
      access,
    );

    expect(resultA.timezone).toBe('America/Sao_Paulo');
    expect(resultA.items.some(({ id }) => id === baselineReservationId)).toBe(true);
    expect(resultB.timezone).toBe('UTC');
    expect(resultB.items).toEqual([]);
  });

  it('persists mutation audit as append-only evidence', async () => {
    const audit = await pool.query<{ count: string }>(
      `SELECT count(*)
         FROM audit_events
        WHERE origin = $1
          AND entity = 'Reservation'
          AND entity_id = $2`,
      [integrationOrigin, baselineReservationId],
    );

    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });

  it('enforces equipment laboratory consistency with the new composite foreign key', async () => {
    await expect(
      pool.query(
        `INSERT INTO equipment_occupations (
           laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status
         ) VALUES ($1, $2, 'TECHNICAL_BLOCK', $3, $4, 'ACTIVE')`,
        [
          laboratoryBId,
          equipmentAId,
          '2031-02-01T12:00:00.000Z',
          '2031-02-01T13:00:00.000Z',
        ],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
