import {
  CANCELLATION_MINIMUM_NOTICE_MINUTES,
  CHECK_IN_EARLY_TOLERANCE_MINUTES,
  CHECK_IN_LOOKUP_WINDOW_HOURS,
  SCHEDULE_ITEM_LIMIT,
  reservationSchema,
  scheduleResponseSchema,
  technicalBlockSchema,
  type CreateReservationInput,
  type CreateReservationResult,
  type CreateTechnicalBlockInput,
  type ListScheduleQuery,
  type ReleaseAbsentReservationsResult,
  type Reservation,
  type ScheduleItem,
  type ScheduleItemStatus,
  type ScheduleResponse,
  type StartWalkInReservationInput,
  type TechnicalBlock,
} from '@arqueia/contracts';

import { inTransaction, type DatabaseClient, type DatabasePool } from '@arqueia/database';

import {
  EquipmentCheckInRefusedError,
  EquipmentUnavailableError,
  EquipmentTrainingRequiredError,
  InvalidReservationProjectError,
  ReservationCancellationNoticeError,
  ReservationCheckInError,
  ReservationCompletionError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationApprovalRequiredError,
  ScheduleResultLimitExceededError,
  SchedulingEquipmentNotFoundError,
  TechnicalBlockNotFoundError,
} from '../domain/scheduling.errors.js';
import { generateRecurrentSlots } from '../domain/recurrence.js';
import type {
  SchedulingAccess,
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
  where?: string;
}

export function isEquipmentOccupationConflict(error: unknown): boolean {
  if (error instanceof ReservationConflictError) {
    return true;
  }

  const pgError = error as PgError;
  if (pgError.code === '23P01') {
    return true;
  }

  if (pgError.code !== '40P01') {
    return false;
  }

  const diagnostics = [pgError.constraint, pgError.detail, pgError.where]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  return (
    /equipment_occupations_no_overlap_excl/i.test(diagnostics) ||
    (/equipment_occupations/i.test(diagnostics) && /exclusion constraint/i.test(diagnostics))
  );
}

interface EquipmentRow {
  id: string;
  status: string;
  max_reservation_minutes: number;
  requires_training: boolean;
  requires_approval: boolean;
  absence_release_minutes: number;
}

interface LaboratoryRow {
  timezone: string;
}

interface ProjectRow {
  id: string;
}

interface OccupationRow {
  id: string;
  laboratory_id: string;
  equipment_id: string;
  occupation_type: 'RESERVATION' | 'TECHNICAL_BLOCK';
  starts_at: Date;
  ends_at: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface ReservationRow extends OccupationRow {
  user_id: string;
  project_id: string | null;
  project_label: string | null;
  project_code?: string;
  purpose: string | null;
  sample_count: number | null;
  notes: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
}

interface TechnicalBlockRow extends OccupationRow {
  created_by_user_id: string;
  reason: 'MAINTENANCE' | 'CALIBRATION' | 'INTERRUPTED_SERVICE' | 'OTHER';
  description: string;
  cancelled_at: Date | null;
  cancelled_by_user_id: string | null;
}

interface CombinedScheduleRow {
  id: string;
  laboratory_id: string;
  equipment_id: string;
  equipment_name: string;
  occupation_type: 'RESERVATION' | 'TECHNICAL_BLOCK';
  starts_at: Date;
  ends_at: Date;
  status: string;
  user_id: string | null;
  reserved_by: string | null;
  project_id: string | null;
  project_label: string | null;
  project_code: string | null;
  purpose: string | null;
  sample_count: number | null;
  notes: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_by_user_id: string | null;
  block_reason: 'MAINTENANCE' | 'CALIBRATION' | 'INTERRUPTED_SERVICE' | 'OTHER' | null;
  description: string | null;
}

function timestamp(value: Date): string {
  return value.toISOString();
}

function mapReservation(row: ReservationRow): Reservation {
  return reservationSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    equipmentId: row.equipment_id,
    userId: row.user_id,
    projectId: row.project_id,
    projectLabel: row.project_label,
    startsAt: timestamp(row.starts_at),
    endsAt: timestamp(row.ends_at),
    status: row.status,
    purpose: row.purpose,
    sampleCount: row.sample_count,
    notes: row.notes,
    startedAt: row.started_at ? timestamp(row.started_at) : null,
    completedAt: row.completed_at ? timestamp(row.completed_at) : null,
    cancelledAt: row.cancelled_at ? timestamp(row.cancelled_at) : null,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at ? timestamp(row.archived_at) : null,
  });
}

/**
 * Escolhe a recusa mais útil quando nenhuma reserva do ator está elegível.
 *
 * Ordem: primeiro o que explica a situação do próprio ator (e que cobre o
 * instante atual), depois a ocupação por terceiros. Nunca expõe o nome de quem
 * reservou.
 */
function refusalFor(
  mine: readonly ReservationRow[],
  rows: readonly ReservationRow[],
  now: number,
  toleranceMs: number,
): EquipmentCheckInRefusedError {
  const startsAt = (row: ReservationRow): number => new Date(row.starts_at).getTime();
  const endsAt = (row: ReservationRow): number => new Date(row.ends_at).getTime();
  const coversNow = (row: ReservationRow): boolean => startsAt(row) <= now && now < endsAt(row);

  const released = mine.find((row) => row.status === 'RELEASED_ABSENCE' && coversNow(row));
  if (released) {
    return new EquipmentCheckInRefusedError(
      'RESERVATION_RELEASED_ABSENCE',
      'Sua reserva foi liberada por ausência. Registre um uso imediato (walk-in) ou faça uma nova reserva.',
      null,
      timestamp(released.ends_at),
    );
  }

  const cancelled = mine.find((row) => row.status === 'CANCELLED' && coversNow(row));
  if (cancelled) {
    return new EquipmentCheckInRefusedError(
      'RESERVATION_CANCELLED',
      'Sua reserva para este horário foi cancelada.',
      null,
      null,
    );
  }

  const upcoming = mine.find(
    (row) => row.status === 'CONFIRMED' && now < startsAt(row) - toleranceMs,
  );
  if (upcoming) {
    return new EquipmentCheckInRefusedError(
      'RESERVATION_NOT_STARTED_YET',
      `Sua reserva ainda não começou. O check-in é liberado ${CHECK_IN_EARLY_TOLERANCE_MINUTES} minutos antes do horário de início.`,
      timestamp(upcoming.starts_at),
      null,
    );
  }

  const occupied = rows.find(
    (row) =>
      (row.status === 'CONFIRMED' || row.status === 'IN_PROGRESS') && coversNow(row),
  );
  if (occupied) {
    return new EquipmentCheckInRefusedError(
      'RESERVATION_OF_ANOTHER_USER',
      'Este equipamento está reservado por outro usuário no momento.',
      null,
      timestamp(occupied.ends_at),
    );
  }

  return new EquipmentCheckInRefusedError(
    'NO_ACTIVE_RESERVATION',
    'Você não possui reserva ativa para este equipamento agora.',
    null,
    null,
  );
}

function mapTechnicalBlock(row: TechnicalBlockRow): TechnicalBlock {
  return technicalBlockSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    equipmentId: row.equipment_id,
    createdByUserId: row.created_by_user_id,
    reason: row.reason,
    description: row.description,
    startsAt: timestamp(row.starts_at),
    endsAt: timestamp(row.ends_at),
    status: row.status,
    cancelledAt: row.cancelled_at ? timestamp(row.cancelled_at) : null,
    cancelledByUserId: row.cancelled_by_user_id,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at ? timestamp(row.archived_at) : null,
  });
}

async function appendAudit(
  client: DatabaseClient,
  context: SchedulingMutationContext,
  laboratoryId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown | null,
  after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       actor_id, laboratory_id, action, entity, entity_id,
       before, after, origin, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      context.actorId,
      laboratoryId,
      action,
      entity,
      entityId,
      before === null ? null : JSON.stringify(before),
      JSON.stringify(after),
      context.origin,
      context.requestId,
    ],
  );
}

export class PostgresSchedulingRepository implements SchedulingRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async createReservation(
    input: CreateReservationInput,
    context: SchedulingMutationContext,
  ): Promise<CreateReservationResult> {
    const targetSlots = generateRecurrentSlots(input.startsAt, input.endsAt, input.recurrence);
    const createdReservations: Reservation[] = [];
    const conflictingSlots: Array<{ startsAt: string; endsAt: string; reason: string }> = [];

    for (const slot of targetSlots) {
      try {
        const reservation = await inTransaction(this.pool, async (client) => {
          const eqResult = await client.query<EquipmentRow>(
            `SELECT id, status, max_reservation_minutes, requires_training, requires_approval, absence_release_minutes
               FROM equipment
              WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL FOR SHARE`,
            [input.equipmentId, input.laboratoryId],
          );
          const eq = eqResult.rows[0];
          if (!eq) {
            throw new Error('Equipamento não foi encontrado no laboratório informado.');
          }
          if (eq.status !== 'AVAILABLE') {
            throw new EquipmentUnavailableError(eq.status);
          }
          if (eq.requires_training) {
            throw new EquipmentTrainingRequiredError();
          }
          if (eq.requires_approval) {
            throw new ReservationApprovalRequiredError();
          }

          // Projeto virou texto livre e é opcional; quando vier um id, ele
          // continua tendo de existir e estar ativo no laboratório.
          if (input.projectId) {
            const projectResult = await client.query<ProjectRow>(
              `SELECT id FROM projects
                WHERE id = $1
                  AND laboratory_id = $2
                  AND status = 'ACTIVE'
                  AND archived_at IS NULL
                FOR SHARE`,
              [input.projectId, input.laboratoryId],
            );
            if (!projectResult.rows[0]) {
              throw new InvalidReservationProjectError();
            }
          }

          const durationMinutes =
            (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;
          if (durationMinutes > eq.max_reservation_minutes) {
            throw new Error(
              `A duração da reserva (${durationMinutes} min) excede o limite do equipamento (${eq.max_reservation_minutes} min).`,
            );
          }

          const occResult = await client.query<OccupationRow>(
            `INSERT INTO equipment_occupations (
               laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status
             ) VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
             RETURNING id, laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status, created_at, updated_at, archived_at`,
            [input.laboratoryId, input.equipmentId, slot.startsAt, slot.endsAt],
          );
          const occupation = occResult.rows[0]!;

          const resResult = await client.query<ReservationRow>(
            `INSERT INTO reservations (
               id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
            [
              occupation.id,
              input.laboratoryId,
              input.equipmentId,
              context.actorId,
              input.projectId ?? null,
              input.projectLabel ?? null,
              input.purpose ?? null,
              input.sampleCount ?? null,
              input.notes ?? null,
            ],
          );
          const row = { ...occupation, ...resResult.rows[0]! };
          const res = mapReservation(row);

          await appendAudit(
            client,
            context,
            input.laboratoryId,
            'scheduling.reservation.created',
            'Reservation',
            res.id,
            null,
            res,
          );

          return res;
        });

        createdReservations.push(reservation);
      } catch (err) {
        if (isEquipmentOccupationConflict(err)) {
          conflictingSlots.push({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            reason: 'O equipamento já possui um agendamento neste horário.',
          });
        } else {
          throw err;
        }
      }
    }

    if (createdReservations.length === 0 && conflictingSlots.length > 0) {
      throw new ReservationConflictError(
        conflictingSlots[0]!.startsAt,
        conflictingSlots[0]!.endsAt,
      );
    }

    return { createdReservations, conflictingSlots };
  }

  public async startWalkInReservation(
    input: StartWalkInReservationInput,
    context: SchedulingMutationContext,
  ): Promise<Reservation> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const eqResult = await client.query<EquipmentRow>(
          `SELECT id, status, max_reservation_minutes, requires_training, requires_approval, absence_release_minutes
             FROM equipment
            WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL FOR SHARE`,
          [input.equipmentId, input.laboratoryId],
        );
        const eq = eqResult.rows[0];
        if (!eq) {
          throw new Error('Equipamento não foi encontrado no laboratório informado.');
        }
        if (eq.status !== 'AVAILABLE') {
          throw new EquipmentUnavailableError(eq.status);
        }
        if (eq.requires_training) {
          throw new EquipmentTrainingRequiredError();
        }
        if (eq.requires_approval) {
          throw new ReservationApprovalRequiredError();
        }

        if (input.projectId) {
          const projectResult = await client.query<ProjectRow>(
            `SELECT id FROM projects
              WHERE id = $1
                AND laboratory_id = $2
                AND status = 'ACTIVE'
                AND archived_at IS NULL
              FOR SHARE`,
            [input.projectId, input.laboratoryId],
          );
          if (!projectResult.rows[0]) {
            throw new InvalidReservationProjectError();
          }
        }

        if (input.durationMinutes > eq.max_reservation_minutes) {
          throw new Error(
            `A duração solicitada (${input.durationMinutes} min) excede o limite do equipamento (${eq.max_reservation_minutes} min).`,
          );
        }

        const now = new Date();
        const startsAt = now.toISOString();
        const endsAt = new Date(now.getTime() + input.durationMinutes * 60_000).toISOString();

        const occResult = await client.query<OccupationRow>(
          `INSERT INTO equipment_occupations (
             laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status
           ) VALUES ($1, $2, 'RESERVATION', $3, $4, 'IN_PROGRESS')
           RETURNING id, laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status, created_at, updated_at, archived_at`,
          [input.laboratoryId, input.equipmentId, startsAt, endsAt],
        );
        const occupation = occResult.rows[0]!;

        const resResult = await client.query<ReservationRow>(
          `INSERT INTO reservations (
             id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
           RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
          [
            occupation.id,
            input.laboratoryId,
            input.equipmentId,
            context.actorId,
            input.projectId ?? null,
            input.projectLabel ?? null,
            input.purpose ?? null,
            input.sampleCount ?? null,
            input.notes ?? null,
          ],
        );
        const row = { ...occupation, ...resResult.rows[0]! };
        const res = mapReservation(row);

        await appendAudit(
          client,
          context,
          input.laboratoryId,
          'scheduling.reservation.walk_in',
          'Reservation',
          res.id,
          null,
          res,
        );

        return res;
      });
    } catch (err) {
      if (isEquipmentOccupationConflict(err)) {
        const now = new Date();
        throw new ReservationConflictError(
          now.toISOString(),
          new Date(now.getTime() + input.durationMinutes * 60_000).toISOString(),
        );
      }
      throw err;
    }
  }

  public async checkInReservation(
    laboratoryId: string,
    reservationId: string,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    return inTransaction(this.pool, async (client) => {
      const queryResult = await client.query<ReservationRow>(
        `SELECT r.id, r.laboratory_id, r.equipment_id, r.user_id, r.project_id, r.project_label, r.purpose,
                r.sample_count, r.notes, r.started_at, r.completed_at, r.cancelled_at, r.cancelled_by_user_id, r.cancellation_reason,
                r.created_at, r.updated_at, r.archived_at,
                o.starts_at, o.ends_at, o.status
           FROM reservations r
           JOIN equipment_occupations o ON o.id = r.id
          WHERE r.id = $1 AND r.laboratory_id = $2 AND r.archived_at IS NULL FOR UPDATE`,
        [reservationId, laboratoryId],
      );

      const beforeRow = queryResult.rows[0];
      if (!beforeRow) {
        throw new ReservationNotFoundError(reservationId);
      }

      if (!canManageReservations && beforeRow.user_id !== context.actorId) {
        throw new Error('Você não tem permissão para fazer check-in nesta reserva.');
      }

      if (beforeRow.status === 'IN_PROGRESS') {
        return mapReservation(beforeRow);
      }

      if (beforeRow.status !== 'CONFIRMED') {
        throw new ReservationCheckInError(
          `Não é possível iniciar reserva com status ${beforeRow.status}.`,
        );
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'IN_PROGRESS', updated_at = now()
          WHERE id = $1 AND laboratory_id = $2`,
        [reservationId, laboratoryId],
      );

      const updateResult = await client.query<ReservationRow>(
        `UPDATE reservations
            SET started_at = now(), updated_at = now()
          WHERE id = $1 AND laboratory_id = $2
          RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
        [reservationId, laboratoryId],
      );

      const afterRow = {
        ...beforeRow,
        ...updateResult.rows[0]!,
        status: 'IN_PROGRESS',
      };
      const before = mapReservation(beforeRow);
      const after = mapReservation(afterRow);

      await appendAudit(
        client,
        context,
        after.laboratoryId,
        'scheduling.reservation.checked_in',
        'Reservation',
        after.id,
        before,
        after,
      );

      return after;
    });
  }

  public async checkInReservationByEquipment(
    laboratoryId: string,
    equipmentId: string,
    context: SchedulingMutationContext,
  ): Promise<Reservation> {
    return inTransaction(this.pool, async (client) => {
      // Equipamento fica fora do join de baixo e é travado apenas com FOR SHARE:
      // não queremos que a leitura do QR bloqueie escritas no cadastro dele.
      const equipmentResult = await client.query<{ id: string }>(
        `SELECT id FROM equipment
          WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL
          FOR SHARE`,
        [equipmentId, laboratoryId],
      );

      if (!equipmentResult.rows[0]) {
        throw new SchedulingEquipmentNotFoundError(equipmentId);
      }

      // Traz TODAS as ocupações da janela, inclusive CANCELLED e RELEASED_ABSENCE
      // (que a constraint de exclusão permite sobrepor linhas vivas) — é isso que
      // permite recusas específicas numa única ida ao banco. `period` é coluna
      // gerada com índice GiST, então `&&` é indexado.
      const windowResult = await client.query<ReservationRow>(
        `SELECT r.id, r.laboratory_id, r.equipment_id, r.user_id, r.project_id, r.project_label, r.purpose,
                r.sample_count, r.notes, r.started_at, r.completed_at, r.cancelled_at, r.cancelled_by_user_id, r.cancellation_reason,
                r.created_at, r.updated_at, r.archived_at,
                o.starts_at, o.ends_at, o.status
           FROM reservations r
           JOIN equipment_occupations o ON o.id = r.id
          WHERE o.equipment_id = $1
            AND o.laboratory_id = $2
            AND o.archived_at IS NULL
            AND r.archived_at IS NULL
            AND o.period && tstzrange(now() - interval '1 hour', now() + ($3 || ' hours')::interval, '[)')
          ORDER BY o.starts_at ASC
          FOR UPDATE`,
        [equipmentId, laboratoryId, String(CHECK_IN_LOOKUP_WINDOW_HOURS)],
      );

      const rows = windowResult.rows;
      const now = Date.now();
      const toleranceMs = CHECK_IN_EARLY_TOLERANCE_MINUTES * 60_000;
      const startsAt = (row: ReservationRow): number => new Date(row.starts_at).getTime();
      const endsAt = (row: ReservationRow): number => new Date(row.ends_at).getTime();
      const mine = rows.filter((row) => row.user_id === context.actorId);

      // 1. Já estou usando este equipamento: idempotente, sem nova auditoria.
      const running = mine.find((row) => row.status === 'IN_PROGRESS' && now < endsAt(row));
      if (running) {
        return mapReservation(running);
      }

      // 2. Minha reserva confirmada, dentro da janela de tolerância.
      const eligible = mine.find(
        (row) =>
          row.status === 'CONFIRMED' && now >= startsAt(row) - toleranceMs && now < endsAt(row),
      );

      if (!eligible) {
        throw refusalFor(mine, rows, now, toleranceMs);
      }

      // Check-in antecipado não pode atropelar quem ainda está na bancada.
      if (now < startsAt(eligible)) {
        const previous = rows.find(
          (row) => row.id !== eligible.id && row.status === 'IN_PROGRESS' && now < endsAt(row),
        );
        if (previous) {
          throw new EquipmentCheckInRefusedError(
            'EQUIPMENT_BUSY_WITH_PREVIOUS',
            'O usuário anterior ainda não finalizou o uso. Aguarde o horário de início da sua reserva.',
            timestamp(eligible.starts_at),
            timestamp(previous.ends_at),
          );
        }
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'IN_PROGRESS', updated_at = now()
          WHERE id = $1 AND laboratory_id = $2`,
        [eligible.id, laboratoryId],
      );

      const updateResult = await client.query<ReservationRow>(
        `UPDATE reservations
            SET started_at = now(), updated_at = now()
          WHERE id = $1 AND laboratory_id = $2
          RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
        [eligible.id, laboratoryId],
      );

      const afterRow = {
        ...eligible,
        ...updateResult.rows[0]!,
        status: 'IN_PROGRESS',
      };
      const before = mapReservation(eligible);
      const after = mapReservation(afterRow);

      // Mesma ação de auditoria do check-in explícito, para não quebrar relatórios.
      await appendAudit(
        client,
        context,
        after.laboratoryId,
        'scheduling.reservation.checked_in',
        'Reservation',
        after.id,
        before,
        after,
      );

      return after;
    });
  }

  public async completeReservation(
    laboratoryId: string,
    reservationId: string,
    notes: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    return inTransaction(this.pool, async (client) => {
      const queryResult = await client.query<ReservationRow>(
        `SELECT r.id, r.laboratory_id, r.equipment_id, r.user_id, r.project_id, r.project_label, r.purpose,
                r.sample_count, r.notes, r.started_at, r.completed_at, r.cancelled_at, r.cancelled_by_user_id, r.cancellation_reason,
                r.created_at, r.updated_at, r.archived_at,
                o.starts_at, o.ends_at, o.status
           FROM reservations r
           JOIN equipment_occupations o ON o.id = r.id
          WHERE r.id = $1 AND r.laboratory_id = $2 AND r.archived_at IS NULL FOR UPDATE`,
        [reservationId, laboratoryId],
      );

      const beforeRow = queryResult.rows[0];
      if (!beforeRow) {
        throw new ReservationNotFoundError(reservationId);
      }

      if (!canManageReservations && beforeRow.user_id !== context.actorId) {
        throw new Error('Você não tem permissão para finalizar esta reserva.');
      }

      if (beforeRow.status === 'COMPLETED') {
        return mapReservation(beforeRow);
      }

      if (beforeRow.status !== 'IN_PROGRESS' && beforeRow.status !== 'CONFIRMED') {
        throw new ReservationCompletionError(
          `Não é possível finalizar reserva com status ${beforeRow.status}.`,
        );
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'COMPLETED', updated_at = now()
          WHERE id = $1 AND laboratory_id = $2`,
        [reservationId, laboratoryId],
      );

      const updateResult = await client.query<ReservationRow>(
        `UPDATE reservations
            SET completed_at = now(),
                notes = COALESCE($3, notes),
                updated_at = now()
          WHERE id = $1 AND laboratory_id = $2
          RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
        [reservationId, laboratoryId, notes ?? null],
      );

      const afterRow = {
        ...beforeRow,
        ...updateResult.rows[0]!,
        status: 'COMPLETED',
      };
      const before = mapReservation(beforeRow);
      const after = mapReservation(afterRow);

      await appendAudit(
        client,
        context,
        after.laboratoryId,
        'scheduling.reservation.completed',
        'Reservation',
        after.id,
        before,
        after,
      );

      return after;
    });
  }

  public async releaseAbsentReservations(
    laboratoryId: string,
    context: SchedulingMutationContext,
  ): Promise<ReleaseAbsentReservationsResult> {
    return inTransaction(this.pool, async (client) => {
      const candidatesResult = await client.query<{ id: string }>(
        `SELECT r.id
           FROM reservations r
           JOIN equipment_occupations o ON o.id = r.id
           JOIN equipment e ON e.id = r.equipment_id
          WHERE r.laboratory_id = $1
            AND r.archived_at IS NULL
            AND o.status = 'CONFIRMED'
            AND o.starts_at + (COALESCE(e.absence_release_minutes, 30) * interval '1 minute') < now()
          FOR UPDATE OF o`,
        [laboratoryId],
      );

      const releasedReservationIds = candidatesResult.rows.map((row) => row.id);
      if (releasedReservationIds.length === 0) {
        return { releasedCount: 0, releasedReservationIds: [] };
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'RELEASED_ABSENCE', updated_at = now()
          WHERE id = ANY($1::uuid[]) AND laboratory_id = $2`,
        [releasedReservationIds, laboratoryId],
      );

      for (const resId of releasedReservationIds) {
        await appendAudit(
          client,
          context,
          laboratoryId,
          'scheduling.reservation.released_absence',
          'Reservation',
          resId,
          { status: 'CONFIRMED' },
          { status: 'RELEASED_ABSENCE' },
        );
      }

      return {
        releasedCount: releasedReservationIds.length,
        releasedReservationIds,
      };
    });
  }

  public async cancelReservation(
    laboratoryId: string,
    reservationId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    return inTransaction(this.pool, async (client) => {
      const queryResult = await client.query<ReservationRow>(
        `SELECT r.id, r.laboratory_id, r.equipment_id, r.user_id, r.project_id, r.project_label, r.purpose,
                r.sample_count, r.notes, r.started_at, r.completed_at, r.cancelled_at, r.cancelled_by_user_id, r.cancellation_reason,
                r.created_at, r.updated_at, r.archived_at,
                o.starts_at, o.ends_at, o.status
           FROM reservations r
           JOIN equipment_occupations o ON o.id = r.id
          WHERE r.id = $1 AND r.laboratory_id = $2 AND r.archived_at IS NULL FOR UPDATE`,
        [reservationId, laboratoryId],
      );

      const beforeRow = queryResult.rows[0];
      if (!beforeRow) {
        throw new ReservationNotFoundError(reservationId);
      }

      const now = new Date();
      const startsAt = new Date(beforeRow.starts_at);

      if (!canManageReservations) {
        if (beforeRow.user_id !== context.actorId) {
          throw new Error('Você não tem permissão para cancelar esta reserva.');
        }
        if (beforeRow.status === 'CANCELLED' || beforeRow.status === 'RELEASED_ABSENCE') {
          return mapReservation(beforeRow);
        }
        const noticeMinutes = (startsAt.getTime() - now.getTime()) / 60000;
        if (noticeMinutes < CANCELLATION_MINIMUM_NOTICE_MINUTES) {
          throw new ReservationCancellationNoticeError();
        }
      } else if (beforeRow.status === 'CANCELLED' || beforeRow.status === 'RELEASED_ABSENCE') {
        return mapReservation(beforeRow);
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'CANCELLED', updated_at = now()
          WHERE id = $1 AND laboratory_id = $2`,
        [reservationId, laboratoryId],
      );

      const updateResult = await client.query<ReservationRow>(
        `UPDATE reservations SET
           cancelled_at = now(),
           cancelled_by_user_id = $2,
           cancellation_reason = $3,
           updated_at = now()
         WHERE id = $1 AND laboratory_id = $4
         RETURNING id, laboratory_id, equipment_id, user_id, project_id, project_label, purpose, sample_count, notes, started_at, completed_at, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
        [reservationId, context.actorId, reason ?? null, laboratoryId],
      );

      const afterRow = {
        ...beforeRow,
        ...updateResult.rows[0]!,
        status: 'CANCELLED',
      };
      const before = mapReservation(beforeRow);
      const after = mapReservation(afterRow);

      await appendAudit(
        client,
        context,
        after.laboratoryId,
        'scheduling.reservation.cancelled',
        'Reservation',
        after.id,
        before,
        after,
      );

      return after;
    });
  }

  public async createTechnicalBlock(
    input: CreateTechnicalBlockInput,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const equipmentResult = await client.query<{ id: string }>(
          `SELECT id FROM equipment
            WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL
            FOR SHARE`,
          [input.equipmentId, input.laboratoryId],
        );
        if (!equipmentResult.rows[0]) {
          throw new Error('Equipamento não foi encontrado no laboratório informado.');
        }

        const occResult = await client.query<OccupationRow>(
          `INSERT INTO equipment_occupations (
             laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status
           ) VALUES ($1, $2, 'TECHNICAL_BLOCK', $3, $4, 'ACTIVE')
           RETURNING id, laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status, created_at, updated_at, archived_at`,
          [input.laboratoryId, input.equipmentId, input.startsAt, input.endsAt],
        );
        const occupation = occResult.rows[0]!;

        const blockResult = await client.query<TechnicalBlockRow>(
          `INSERT INTO technical_blocks (
             id, laboratory_id, equipment_id, created_by_user_id, reason, description
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, laboratory_id, equipment_id, created_by_user_id, reason, description, cancelled_at, cancelled_by_user_id, created_at, updated_at, archived_at`,
          [
            occupation.id,
            input.laboratoryId,
            input.equipmentId,
            context.actorId,
            input.reason,
            input.description,
          ],
        );

        const row = { ...occupation, ...blockResult.rows[0]! };
        const block = mapTechnicalBlock(row);

        await appendAudit(
          client,
          context,
          input.laboratoryId,
          'scheduling.block.created',
          'TechnicalBlock',
          block.id,
          null,
          block,
        );

        return block;
      });
    } catch (error) {
      if (isEquipmentOccupationConflict(error)) {
        throw new ReservationConflictError(input.startsAt, input.endsAt);
      }
      throw error;
    }
  }

  public async cancelTechnicalBlock(
    laboratoryId: string,
    technicalBlockId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock> {
    return inTransaction(this.pool, async (client) => {
      const queryResult = await client.query<TechnicalBlockRow>(
        `SELECT b.id, b.laboratory_id, b.equipment_id, b.created_by_user_id, b.reason, b.description,
                b.cancelled_at, b.cancelled_by_user_id, b.created_at, b.updated_at, b.archived_at,
                o.starts_at, o.ends_at, o.status
           FROM technical_blocks b
           JOIN equipment_occupations o ON o.id = b.id
          WHERE b.id = $1 AND b.laboratory_id = $2 AND b.archived_at IS NULL FOR UPDATE`,
        [technicalBlockId, laboratoryId],
      );

      const beforeRow = queryResult.rows[0];
      if (!beforeRow) {
        throw new TechnicalBlockNotFoundError(technicalBlockId);
      }

      if (beforeRow.status === 'CANCELLED') {
        return mapTechnicalBlock(beforeRow);
      }

      await client.query(
        `UPDATE equipment_occupations
            SET status = 'CANCELLED', updated_at = now()
          WHERE id = $1 AND laboratory_id = $2`,
        [technicalBlockId, laboratoryId],
      );

      const updateResult = await client.query<TechnicalBlockRow>(
        `UPDATE technical_blocks SET
           cancelled_at = now(),
           cancelled_by_user_id = $2,
           updated_at = now()
         WHERE id = $1 AND laboratory_id = $3
         RETURNING id, laboratory_id, equipment_id, created_by_user_id, reason, description, cancelled_at, cancelled_by_user_id, created_at, updated_at, archived_at`,
        [technicalBlockId, context.actorId, laboratoryId],
      );

      const afterRow = {
        ...beforeRow,
        ...updateResult.rows[0]!,
        status: 'CANCELLED',
      };
      const before = mapTechnicalBlock(beforeRow);
      const after = mapTechnicalBlock(afterRow);

      await appendAudit(
        client,
        context,
        after.laboratoryId,
        'scheduling.block.cancelled',
        'TechnicalBlock',
        after.id,
        before,
        after,
      );

      return after;
    });
  }

  public async listSchedule(
    query: ListScheduleQuery,
    requestingUserId: string,
    access: SchedulingAccess,
  ): Promise<ScheduleResponse> {
    const laboratoryResult = await this.pool.query<LaboratoryRow>(
      `SELECT timezone FROM laboratories WHERE id = $1 AND archived_at IS NULL`,
      [query.laboratoryId],
    );
    const laboratory = laboratoryResult.rows[0];
    if (!laboratory) {
      throw new Error('Laboratório não encontrado.');
    }

    const result = await this.pool.query<CombinedScheduleRow>(
      `SELECT o.id, o.laboratory_id, o.equipment_id, e.name AS equipment_name, o.occupation_type,
              o.starts_at, o.ends_at, o.status,
              r.user_id, ru.name AS reserved_by,
              r.project_id, r.project_label, p.code AS project_code,
              r.purpose, r.sample_count, r.notes, r.started_at, r.completed_at,
              tb.created_by_user_id, tb.reason AS block_reason, tb.description
         FROM equipment_occupations o
         JOIN equipment e ON e.id = o.equipment_id
    LEFT JOIN reservations r ON r.id = o.id
    LEFT JOIN users ru ON ru.id = r.user_id
    LEFT JOIN projects p ON p.id = r.project_id
    LEFT JOIN technical_blocks tb ON tb.id = o.id
        WHERE o.laboratory_id = $1
          AND o.archived_at IS NULL
          AND o.starts_at < $3 AND o.ends_at > $2
          AND ($4::uuid IS NULL OR o.equipment_id = $4)
          AND ($5::boolean IS FALSE OR r.user_id = $6)
          AND ($7::boolean IS TRUE OR o.status NOT IN ('CANCELLED', 'RELEASED_ABSENCE'))
          AND ($8::varchar IS NULL OR o.status = $8)
        ORDER BY o.starts_at ASC, o.id ASC
        LIMIT $9`,
      [
        query.laboratoryId,
        query.startsAt,
        query.endsAt,
        query.equipmentId ?? null,
        query.onlyMine ?? false,
        requestingUserId,
        query.includeCancelled ?? false,
        query.status ?? null,
        SCHEDULE_ITEM_LIMIT + 1,
      ],
    );

    if (result.rows.length > SCHEDULE_ITEM_LIMIT) {
      throw new ScheduleResultLimitExceededError(SCHEDULE_ITEM_LIMIT);
    }

    const items: ScheduleItem[] = result.rows.map((row) => {
      const isMine = row.user_id === requestingUserId;
      const canSeeDetails = access.canViewPrivateReservations || isMine;
      const status = row.status as ScheduleItemStatus;
      const canControl = access.canManageReservations || isMine;

      if (row.occupation_type === 'RESERVATION') {
        const canCheckIn =
          status === 'CONFIRMED' && canControl;
        const canComplete =
          (status === 'IN_PROGRESS' || status === 'CONFIRMED') && canControl;

        return {
          id: row.id,
          type: 'RESERVATION',
          equipmentId: row.equipment_id,
          equipmentName: row.equipment_name,
          startsAt: timestamp(row.starts_at),
          endsAt: timestamp(row.ends_at),
          title: canSeeDetails
            // Finalidade e projeto são opcionais; o título usa o que houver.
            ? `Reserva${row.purpose ? `: ${row.purpose}` : row.project_label ? `: ${row.project_label}` : ''}`
            : 'Equipamento Reservado',
          // Quem reservou aparece para todo mundo que enxerga a agenda: é a
          // informação que evita disputa de horário no balcão do laboratório.
          reservedBy: row.reserved_by ?? null,
          status,
          isMine,
          canCancel:
            status !== 'CANCELLED' &&
            status !== 'RELEASED_ABSENCE' &&
            status !== 'COMPLETED' &&
            (access.canManageReservations || (isMine && access.canCancelOwn)),
          canCheckIn,
          canComplete,
          reservationDetails: canSeeDetails
            ? {
                reservationId: row.id,
                userId: row.user_id!,
                projectId: row.project_id,
                projectCode: row.project_code ?? undefined,
                projectLabel: row.project_label,
                purpose: row.purpose,
                sampleCount: row.sample_count ?? undefined,
                notes: row.notes ?? undefined,
                startedAt: row.started_at ? timestamp(row.started_at) : null,
                completedAt: row.completed_at ? timestamp(row.completed_at) : null,
                status: row.status as 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RELEASED_ABSENCE',
              }
            : null,
        };
      }

      return {
        id: row.id,
        type: 'TECHNICAL_BLOCK',
        equipmentId: row.equipment_id,
        equipmentName: row.equipment_name,
        startsAt: timestamp(row.starts_at),
        endsAt: timestamp(row.ends_at),
        title: 'Bloqueio técnico',
        reservedBy: null,
        status,
        isMine: false,
        canCancel: status !== 'CANCELLED' && access.canManageBlocks,
        canCheckIn: false,
        canComplete: false,
        blockDetails: access.canManageBlocks
          ? {
              technicalBlockId: row.id,
              reason: row.block_reason!,
              description: row.description ?? '',
              createdByUserId: row.created_by_user_id!,
              status: row.status as 'ACTIVE' | 'CANCELLED',
            }
          : null,
      };
    });

    return scheduleResponseSchema.parse({
      laboratoryId: query.laboratoryId,
      timezone: laboratory.timezone,
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      capabilities: {
        canReserve: access.canReserve,
        canManageBlocks: access.canManageBlocks,
      },
      items,
    });
  }
}
