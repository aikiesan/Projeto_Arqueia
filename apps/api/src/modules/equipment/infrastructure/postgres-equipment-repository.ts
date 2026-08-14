import {
  equipmentSchema,
  type CreateEquipmentInput,
  type Equipment,
  type EquipmentPage,
  type UpdateEquipmentInput,
} from '@arqueia/contracts';
import { inTransaction, type DatabaseClient, type DatabasePool } from '@arqueia/database';

import {
  EquipmentConflictError,
  EquipmentNotFoundError,
  EquipmentReferenceError,
} from '../domain/equipment.errors.js';
import type {
  EquipmentListQuery,
  EquipmentMutationContext,
  EquipmentRepository,
} from '../domain/ports/equipment-repository.port.js';

interface EquipmentRow {
  id: string;
  laboratory_id: string;
  catalog_option_id: string;
  space_option_id: string | null;
  bench_option_id: string | null;
  responsible_user_id: string | null;
  code: string;
  name: string;
  asset_tag: string | null;
  serial_number: string | null;
  status: string;
  max_reservation_minutes: number;
  requires_training: boolean;
  requires_approval: boolean;
  absence_release_minutes: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface CountRow { count: string | number }
interface PgError { code?: string }

const COLUMNS = `id, laboratory_id, catalog_option_id, space_option_id, bench_option_id,
  responsible_user_id, code, name, asset_tag, serial_number, status,
  max_reservation_minutes, requires_training, requires_approval,
  absence_release_minutes, notes, created_at, updated_at, archived_at`;

function timestamp(value: Date): string {
  return value.toISOString();
}

function mapEquipment(row: EquipmentRow): Equipment {
  return equipmentSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    catalogOptionId: row.catalog_option_id,
    spaceOptionId: row.space_option_id,
    benchOptionId: row.bench_option_id,
    responsibleUserId: row.responsible_user_id,
    code: row.code,
    name: row.name,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    status: row.status,
    reservationPolicy: {
      maxReservationMinutes: row.max_reservation_minutes,
      requiresTraining: row.requires_training,
      requiresApproval: row.requires_approval,
      absenceReleaseMinutes: row.absence_release_minutes,
    },
    notes: row.notes,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  });
}

function escapedLikeSearch(search: string | undefined): string | null {
  return search === undefined ? null : `%${search.replace(/[\\%_]/g, '\\$&')}%`;
}

async function assertCatalogReferences(
  client: DatabaseClient,
  laboratoryId: string,
  catalogOptionId: string,
  spaceOptionId: string | null,
  benchOptionId: string | null,
): Promise<void> {
  const result = await client.query<CountRow>(
    `SELECT count(*) AS count
       FROM catalog_options model
      WHERE model.id = $2
        AND model.laboratory_id = $1
        AND model.kind IN ('EQUIPMENT_TYPE', 'EQUIPMENT_MODEL')
        AND model.is_selectable = true
        AND model.archived_at IS NULL
        AND ($3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM catalog_options space
           WHERE space.id = $3 AND space.laboratory_id = $1
             AND space.kind = 'SPACE' AND space.is_selectable = true
             AND space.archived_at IS NULL
        ))
        AND ($4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM catalog_options bench
           WHERE bench.id = $4 AND bench.laboratory_id = $1
             AND bench.kind = 'BENCH' AND bench.is_selectable = true
             AND bench.archived_at IS NULL
        ))`,
    [laboratoryId, catalogOptionId, spaceOptionId, benchOptionId],
  );
  if (Number(result.rows[0]?.count ?? 0) !== 1) throw new EquipmentReferenceError();
}

async function appendAudit(
  client: DatabaseClient,
  context: EquipmentMutationContext,
  laboratoryId: string,
  action: string,
  entityId: string,
  before: Equipment | null,
  after: Equipment,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       actor_id, laboratory_id, action, entity, entity_id,
       before, after, origin, request_id
     ) VALUES ($1, $2, $3, 'Equipment', $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      context.actorId,
      laboratoryId,
      action,
      entityId,
      before === null ? null : JSON.stringify(before),
      JSON.stringify(after),
      context.origin,
      context.requestId,
    ],
  );
}

function translateWriteError(error: unknown): never {
  if (
    error instanceof EquipmentNotFoundError ||
    error instanceof EquipmentReferenceError ||
    error instanceof EquipmentConflictError
  ) throw error;
  if ((error as PgError).code === '23505') throw new EquipmentConflictError();
  if ((error as PgError).code === '23503') throw new EquipmentReferenceError();
  throw error;
}

export class PostgresEquipmentRepository implements EquipmentRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async list(query: EquipmentListQuery): Promise<EquipmentPage> {
    const result = await this.pool.query<EquipmentRow>(
      `SELECT ${COLUMNS} FROM equipment e
        WHERE e.laboratory_id = $1
          AND e.archived_at IS NULL
          AND ($2::text IS NULL OR e.status = $2)
          AND ($3::text IS NULL OR e.name ILIKE $3 ESCAPE '\\' OR e.code ILIKE $3 ESCAPE '\\')
          AND ($4::uuid IS NULL OR (lower(e.name), e.id) > (
            SELECT lower(cursor_equipment.name), cursor_equipment.id
              FROM equipment cursor_equipment
             WHERE cursor_equipment.id = $4
               AND cursor_equipment.laboratory_id = $1
               AND cursor_equipment.archived_at IS NULL
          ))
        ORDER BY lower(e.name), e.id
        LIMIT $5`,
      [
        query.laboratoryId,
        query.status ?? null,
        escapedLikeSearch(query.search),
        query.cursor ?? null,
        query.limit + 1,
      ],
    );
    const hasNextPage = result.rows.length > query.limit;
    const items = result.rows.slice(0, query.limit).map(mapEquipment);
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  public async findActiveById(equipmentId: string): Promise<Equipment | null> {
    const result = await this.pool.query<EquipmentRow>(
      `SELECT ${COLUMNS} FROM equipment WHERE id = $1 AND archived_at IS NULL LIMIT 1`,
      [equipmentId],
    );
    return result.rows[0] === undefined ? null : mapEquipment(result.rows[0]);
  }

  public async create(
    input: CreateEquipmentInput,
    context: EquipmentMutationContext,
  ): Promise<Equipment> {
    try {
      return await inTransaction(this.pool, async (client) => {
        await assertCatalogReferences(
          client,
          input.laboratoryId,
          input.catalogOptionId,
          input.spaceOptionId ?? null,
          input.benchOptionId ?? null,
        );
        const policy = input.reservationPolicy ?? {
          maxReservationMinutes: 720,
          requiresTraining: true,
          requiresApproval: false,
          absenceReleaseMinutes: 30,
        };
        const result = await client.query<EquipmentRow>(
          `INSERT INTO equipment (
             laboratory_id, catalog_option_id, space_option_id, bench_option_id,
             responsible_user_id, code, name, asset_tag, serial_number,
             max_reservation_minutes, requires_training, requires_approval,
             absence_release_minutes, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING ${COLUMNS}`,
          [
            input.laboratoryId,
            input.catalogOptionId,
            input.spaceOptionId ?? null,
            input.benchOptionId ?? null,
            input.responsibleUserId ?? null,
            input.code,
            input.name,
            input.assetTag ?? null,
            input.serialNumber ?? null,
            policy.maxReservationMinutes,
            policy.requiresTraining,
            policy.requiresApproval,
            policy.absenceReleaseMinutes,
            input.notes ?? null,
          ],
        );
        const equipment = mapEquipment(result.rows[0]!);
        await appendAudit(
          client,
          context,
          equipment.laboratoryId,
          'equipment.created',
          equipment.id,
          null,
          equipment,
        );
        return equipment;
      });
    } catch (error) {
      return translateWriteError(error);
    }
  }

  public async update(
    equipmentId: string,
    input: UpdateEquipmentInput,
    context: EquipmentMutationContext,
  ): Promise<Equipment> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<EquipmentRow>(
          `SELECT ${COLUMNS} FROM equipment
            WHERE id = $1 AND archived_at IS NULL FOR UPDATE`,
          [equipmentId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) throw new EquipmentNotFoundError(equipmentId);

        await assertCatalogReferences(
          client,
          beforeRow.laboratory_id,
          input.catalogOptionId ?? beforeRow.catalog_option_id,
          'spaceOptionId' in input ? input.spaceOptionId ?? null : beforeRow.space_option_id,
          'benchOptionId' in input ? input.benchOptionId ?? null : beforeRow.bench_option_id,
        );
        const policy = input.reservationPolicy;
        const result = await client.query<EquipmentRow>(
          `UPDATE equipment SET
             catalog_option_id = CASE WHEN $2::boolean THEN $3 ELSE catalog_option_id END,
             space_option_id = CASE WHEN $4::boolean THEN $5 ELSE space_option_id END,
             bench_option_id = CASE WHEN $6::boolean THEN $7 ELSE bench_option_id END,
             responsible_user_id = CASE WHEN $8::boolean THEN $9 ELSE responsible_user_id END,
             code = CASE WHEN $10::boolean THEN $11 ELSE code END,
             name = CASE WHEN $12::boolean THEN $13 ELSE name END,
             asset_tag = CASE WHEN $14::boolean THEN $15 ELSE asset_tag END,
             serial_number = CASE WHEN $16::boolean THEN $17 ELSE serial_number END,
             status = CASE WHEN $18::boolean THEN $19 ELSE status END,
             max_reservation_minutes = CASE WHEN $20::boolean THEN $21 ELSE max_reservation_minutes END,
             requires_training = CASE WHEN $20::boolean THEN $22 ELSE requires_training END,
             requires_approval = CASE WHEN $20::boolean THEN $23 ELSE requires_approval END,
             absence_release_minutes = CASE WHEN $20::boolean THEN $24 ELSE absence_release_minutes END,
             notes = CASE WHEN $25::boolean THEN $26 ELSE notes END
           WHERE id = $1 AND archived_at IS NULL
           RETURNING ${COLUMNS}`,
          [
            equipmentId,
            'catalogOptionId' in input, input.catalogOptionId ?? null,
            'spaceOptionId' in input, input.spaceOptionId ?? null,
            'benchOptionId' in input, input.benchOptionId ?? null,
            'responsibleUserId' in input, input.responsibleUserId ?? null,
            'code' in input, input.code ?? null,
            'name' in input, input.name ?? null,
            'assetTag' in input, input.assetTag ?? null,
            'serialNumber' in input, input.serialNumber ?? null,
            'status' in input, input.status ?? null,
            policy !== undefined,
            policy?.maxReservationMinutes ?? null,
            policy?.requiresTraining ?? null,
            policy?.requiresApproval ?? null,
            policy?.absenceReleaseMinutes ?? null,
            'notes' in input, input.notes ?? null,
          ],
        );
        const before = mapEquipment(beforeRow);
        const after = mapEquipment(result.rows[0]!);
        await appendAudit(
          client,
          context,
          after.laboratoryId,
          'equipment.updated',
          after.id,
          before,
          after,
        );
        return after;
      });
    } catch (error) {
      return translateWriteError(error);
    }
  }
}
