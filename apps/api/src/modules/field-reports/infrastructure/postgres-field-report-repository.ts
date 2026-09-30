import {
  fieldReportReference,
  fieldReportSchema,
  publicFieldReportFormSchema,
  PUBLIC_FIELD_REPORT_EQUIPMENT_LIMIT,
  type FieldReport,
  type FieldReportPage,
  type ListFieldReportsQuery,
  type ParsedReviewFieldReportInput,
  type ParsedSubmitFieldReportInput,
  type PublicFieldReportForm,
} from '@arqueia/contracts';
import { inTransaction, type DatabaseClient, type DatabasePool } from '@arqueia/database';

import {
  FieldReportEquipmentMismatchError,
  FieldReportLaboratoryNotFoundError,
  FieldReportNotFoundError,
} from '../domain/field-report.errors.js';
import type {
  FieldReportCountRow,
  FieldReportRequestContext,
  FieldReportReviewContext,
  FieldReportReviewRepository,
  PublicFieldReportGateway,
  SubmittedFieldReport,
} from '../domain/ports/field-report-repository.port.js';

interface FieldReportRow {
  id: string;
  laboratory_id: string;
  equipment_id: string | null;
  equipment_code: string | null;
  equipment_name: string | null;
  kind: string;
  status: string;
  message: string;
  blocks_use: boolean;
  reporter_name: string | null;
  reporter_contact: string | null;
  review_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface CountRow {
  kind: FieldReportCountRow['kind'];
  status: FieldReportCountRow['status'];
  blocks_use: boolean;
  count: string | number;
}

const SELECT_REPORT = `
  SELECT fr.id, fr.laboratory_id, fr.equipment_id,
         e.code AS equipment_code, e.name AS equipment_name,
         fr.kind, fr.status, fr.message, fr.blocks_use,
         fr.reporter_name, fr.reporter_contact, fr.review_note,
         fr.reviewed_by_user_id, reviewer.name AS reviewed_by_name, fr.reviewed_at,
         fr.created_at, fr.updated_at, fr.archived_at
    FROM field_reports fr
    LEFT JOIN equipment e ON e.id = fr.equipment_id
    LEFT JOIN users reviewer ON reviewer.id = fr.reviewed_by_user_id`;

function timestamp(value: Date): string {
  return value.toISOString();
}

function mapFieldReport(row: FieldReportRow): FieldReport {
  return fieldReportSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    reference: fieldReportReference(row.id),
    kind: row.kind,
    status: row.status,
    equipment:
      row.equipment_id === null || row.equipment_code === null || row.equipment_name === null
        ? null
        : { id: row.equipment_id, code: row.equipment_code, name: row.equipment_name },
    message: row.message,
    blocksUse: row.blocks_use,
    reporterName: row.reporter_name,
    reporterContact: row.reporter_contact,
    reviewNote: row.review_note,
    reviewedBy:
      row.reviewed_by_user_id === null || row.reviewed_by_name === null
        ? null
        : { id: row.reviewed_by_user_id, name: row.reviewed_by_name },
    reviewedAt: row.reviewed_at === null ? null : timestamp(row.reviewed_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  });
}

/**
 * Auditoria sem o texto do informe nem a identificação de quem enviou.
 *
 * `audit_events` é append-only e nunca apaga: gravar ali a mensagem ou o
 * contato tornaria impossível atender a um pedido de eliminação (LGPD). A
 * trilha guarda o fato (quem, quando, qual informe, qual transição); o
 * conteúdo fica só na linha do informe.
 */
async function appendAudit(
  client: DatabaseClient,
  input: {
    readonly actorId: string | null;
    readonly laboratoryId: string;
    readonly action: string;
    readonly fieldReportId: string;
    readonly before: Record<string, unknown> | null;
    readonly after: Record<string, unknown>;
    readonly context: FieldReportRequestContext;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       actor_id, laboratory_id, action, entity, entity_id,
       before, after, origin, request_id
     ) VALUES ($1, $2, $3, 'FieldReport', $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      input.actorId,
      input.laboratoryId,
      input.action,
      input.fieldReportId,
      input.before === null ? null : JSON.stringify(input.before),
      JSON.stringify(input.after),
      input.context.origin,
      input.context.requestId,
    ],
  );
}

async function findReport(
  client: DatabaseClient | DatabasePool,
  fieldReportId: string,
): Promise<FieldReport | null> {
  const result = await client.query<FieldReportRow>(
    `${SELECT_REPORT} WHERE fr.id = $1 AND fr.archived_at IS NULL LIMIT 1`,
    [fieldReportId],
  );
  return result.rows[0] === undefined ? null : mapFieldReport(result.rows[0]);
}

export class PostgresFieldReportRepository
  implements PublicFieldReportGateway, FieldReportReviewRepository
{
  public constructor(private readonly pool: DatabasePool) {}

  public async findPublicForm(laboratoryId: string): Promise<PublicFieldReportForm | null> {
    const laboratory = await this.pool.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name FROM laboratories WHERE id = $1 AND archived_at IS NULL`,
      [laboratoryId],
    );
    const row = laboratory.rows[0];
    if (row === undefined) return null;

    // Coluna por coluna: o formulário é público e não pode herdar, por
    // refatoração, notas, patrimônio ou responsável do equipamento.
    const equipment = await this.pool.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name
         FROM equipment
        WHERE laboratory_id = $1 AND archived_at IS NULL
        ORDER BY lower(name), id
        LIMIT $2`,
      [laboratoryId, PUBLIC_FIELD_REPORT_EQUIPMENT_LIMIT],
    );

    return publicFieldReportFormSchema.parse({
      laboratory: { id: row.id, code: row.code, name: row.name },
      equipment: equipment.rows,
    });
  }

  public submit(
    input: ParsedSubmitFieldReportInput,
    context: FieldReportRequestContext,
  ): Promise<SubmittedFieldReport> {
    return inTransaction(this.pool, async (client) => {
      const laboratory = await client.query(
        `SELECT 1 FROM laboratories WHERE id = $1 AND archived_at IS NULL`,
        [input.laboratoryId],
      );
      if (laboratory.rowCount === 0) throw new FieldReportLaboratoryNotFoundError();

      if (input.equipmentId !== null) {
        const equipment = await client.query(
          `SELECT 1 FROM equipment
            WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL`,
          [input.equipmentId, input.laboratoryId],
        );
        if (equipment.rowCount === 0) throw new FieldReportEquipmentMismatchError();
      }

      const inserted = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO field_reports (
           laboratory_id, equipment_id, kind, message, blocks_use,
           reporter_name, reporter_contact
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, created_at`,
        [
          input.laboratoryId,
          input.equipmentId,
          input.kind,
          input.message,
          input.blocksUse,
          input.reporterName,
          input.reporterContact,
        ],
      );
      const created = inserted.rows[0];
      if (created === undefined) throw new Error('INSERT em field_reports não retornou linha.');

      await appendAudit(client, {
        actorId: null,
        laboratoryId: input.laboratoryId,
        action: 'field-report.submitted',
        fieldReportId: created.id,
        before: null,
        after: {
          kind: input.kind,
          status: 'NEW',
          equipmentId: input.equipmentId,
          blocksUse: input.blocksUse,
        },
        context,
      });

      return { id: created.id, createdAt: timestamp(created.created_at) };
    });
  }

  public async list(query: ListFieldReportsQuery): Promise<FieldReportPage> {
    const result = await this.pool.query<FieldReportRow>(
      `${SELECT_REPORT}
        WHERE fr.laboratory_id = $1
          AND fr.archived_at IS NULL
          AND ($2::text IS NULL OR fr.kind = $2)
          AND ($3::text IS NULL OR fr.status = $3)
          AND ($4::uuid IS NULL OR (fr.created_at, fr.id) < (
            SELECT cursor_report.created_at, cursor_report.id
              FROM field_reports cursor_report
             WHERE cursor_report.id = $4
               AND cursor_report.laboratory_id = $1
          ))
        ORDER BY fr.created_at DESC, fr.id DESC
        LIMIT $5`,
      [
        query.laboratoryId,
        query.kind ?? null,
        query.status ?? null,
        query.cursor ?? null,
        query.limit + 1,
      ],
    );
    const hasNextPage = result.rows.length > query.limit;
    const items = result.rows.slice(0, query.limit).map(mapFieldReport);
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  public async countByKindAndStatus(laboratoryId: string): Promise<readonly FieldReportCountRow[]> {
    const result = await this.pool.query<CountRow>(
      `SELECT kind, status, blocks_use, count(*) AS count
         FROM field_reports
        WHERE laboratory_id = $1 AND archived_at IS NULL
        GROUP BY kind, status, blocks_use`,
      [laboratoryId],
    );
    return result.rows.map((row) => ({
      kind: row.kind,
      status: row.status,
      blocksUse: row.blocks_use,
      count: Number(row.count),
    }));
  }

  public findActiveById(fieldReportId: string): Promise<FieldReport | null> {
    return findReport(this.pool, fieldReportId);
  }

  public review(
    fieldReportId: string,
    input: ParsedReviewFieldReportInput,
    context: FieldReportReviewContext,
  ): Promise<FieldReport> {
    return inTransaction(this.pool, async (client) => {
      const locked = await client.query<{ status: string; laboratory_id: string }>(
        `SELECT status, laboratory_id FROM field_reports
          WHERE id = $1 AND archived_at IS NULL
          FOR UPDATE`,
        [fieldReportId],
      );
      const before = locked.rows[0];
      if (before === undefined) throw new FieldReportNotFoundError(fieldReportId);

      // `reviewNote` ausente mantém a nota; null limpa; texto substitui.
      await client.query(
        `UPDATE field_reports
            SET status = $2,
                review_note = CASE WHEN $3::boolean THEN $4 ELSE review_note END,
                reviewed_by_user_id = $5,
                reviewed_at = now()
          WHERE id = $1`,
        [
          fieldReportId,
          input.status,
          input.reviewNote !== undefined,
          input.reviewNote ?? null,
          context.actorId,
        ],
      );

      await appendAudit(client, {
        actorId: context.actorId,
        laboratoryId: before.laboratory_id,
        action: 'field-report.reviewed',
        fieldReportId,
        before: { status: before.status },
        after: { status: input.status, reviewNoteChanged: input.reviewNote !== undefined },
        context,
      });

      const updated = await findReport(client, fieldReportId);
      if (updated === null) throw new FieldReportNotFoundError(fieldReportId);
      return updated;
    });
  }
}
