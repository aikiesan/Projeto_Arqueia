import {
  CANCELLATION_MINIMUM_NOTICE_MINUTES,
  SCHEDULE_ITEM_LIMIT,
  reservationSchema,
  scheduleResponseSchema,
  technicalBlockSchema,
  type CreateReservationInput,
  type CreateReservationResult,
  type CreateTechnicalBlockInput,
  type ListScheduleQuery,
  type Reservation,
  type ScheduleItem,
  type ScheduleItemStatus,
  type ScheduleResponse,
  type TechnicalBlock,
} from '@arqueia/contracts';

import { inTransaction, type DatabaseClient, type DatabasePool } from '@arqueia/database';

import {
  EquipmentUnavailableError,
  EquipmentTrainingRequiredError,
  InvalidReservationProjectError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationApprovalRequiredError,
  ScheduleResultLimitExceededError,
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
}

interface EquipmentRow {
  id: string;
  status: string;
  max_reservation_minutes: number;
  requires_training: boolean;
  requires_approval: boolean;
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
  user_name?: string;
  project_id: string;
  project_code?: string;
  purpose: string;
  sample_count: number | null;
  notes: string | null;
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
  user_name: string | null;
  project_id: string | null;
  project_code: string | null;
  purpose: string | null;
  sample_count: number | null;
  notes: string | null;
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
    startsAt: timestamp(row.starts_at),
    endsAt: timestamp(row.ends_at),
    status: row.status,
    purpose: row.purpose,
    sampleCount: row.sample_count,
    notes: row.notes,
    cancelledAt: row.cancelled_at ? timestamp(row.cancelled_at) : null,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at ? timestamp(row.archived_at) : null,
  });
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
            `SELECT id, status, max_reservation_minutes, requires_training, requires_approval
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
               id, laboratory_id, equipment_id, user_id, project_id, purpose, sample_count, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, laboratory_id, equipment_id, user_id, project_id, purpose, sample_count, notes, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
            [
              occupation.id,
              input.laboratoryId,
              input.equipmentId,
              context.actorId,
              input.projectId,
              input.purpose,
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
        if ((err as PgError).code === '23P01' || err instanceof ReservationConflictError) {
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


  public async cancelReservation(
    laboratoryId: string,
    reservationId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    return inTransaction(this.pool, async (client) => {
        const queryResult = await client.query<ReservationRow>(
          `SELECT r.id, r.laboratory_id, r.equipment_id, r.user_id, r.project_id, r.purpose,
                  r.sample_count, r.notes, r.cancelled_at, r.cancelled_by_user_id, r.cancellation_reason,
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
          if (beforeRow.status === 'CANCELLED') {
            return mapReservation(beforeRow);
          }
          const noticeMinutes = (startsAt.getTime() - now.getTime()) / 60000;
          if (noticeMinutes < CANCELLATION_MINIMUM_NOTICE_MINUTES) {
            throw new ReservationCancellationNoticeError();
          }
        } else if (beforeRow.status === 'CANCELLED') {
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
           RETURNING id, laboratory_id, equipment_id, user_id, project_id, purpose, sample_count, notes, cancelled_at, cancelled_by_user_id, cancellation_reason, created_at, updated_at, archived_at`,
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
      if ((error as PgError).code === '23P01') {
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
              r.user_id, u.name AS user_name, r.project_id, p.code AS project_code,
              r.purpose, r.sample_count, r.notes,
              tb.created_by_user_id, tb.reason AS block_reason, tb.description
         FROM equipment_occupations o
         JOIN equipment e ON e.id = o.equipment_id
    LEFT JOIN reservations r ON r.id = o.id
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN projects p ON p.id = r.project_id
    LEFT JOIN technical_blocks tb ON tb.id = o.id
        WHERE o.laboratory_id = $1
          AND o.archived_at IS NULL
          AND o.starts_at < $3 AND o.ends_at > $2
          AND ($4::uuid IS NULL OR o.equipment_id = $4)
          AND ($5::boolean IS FALSE OR r.user_id = $6)
          AND ($7::boolean IS TRUE OR o.status != 'CANCELLED')
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

      if (row.occupation_type === 'RESERVATION') {
        return {
          id: row.id,
          type: 'RESERVATION',
          equipmentId: row.equipment_id,
          equipmentName: row.equipment_name,
          startsAt: timestamp(row.starts_at),
          endsAt: timestamp(row.ends_at),
          title: canSeeDetails
            ? `Reserva: ${row.purpose ?? 'Sem finalidade'}`
            : 'Equipamento Reservado',
          status,
          isMine,
          canCancel:
            status !== 'CANCELLED' &&
            (access.canManageReservations || (isMine && access.canCancelOwn)),
          reservationDetails: canSeeDetails
            ? {
                reservationId: row.id,
                userId: row.user_id!,
                userName: row.user_name ?? undefined,
                projectId: row.project_id!,
                projectCode: row.project_code ?? undefined,
                purpose: row.purpose ?? '',
                sampleCount: row.sample_count ?? undefined,
                notes: row.notes ?? undefined,
                status: row.status as 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
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
        status,
        isMine: false,
        canCancel: status !== 'CANCELLED' && access.canManageBlocks,
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
