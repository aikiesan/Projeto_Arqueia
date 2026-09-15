import {
  PUBLIC_SCHEDULE_ITEM_LIMIT,
  publicLaboratoryListSchema,
  publicScheduleResponseSchema,
  type PublicLaboratory,
  type PublicScheduleQuery,
  type PublicScheduleResponse,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

/**
 * Leitura da agenda para consumo PÚBLICO (sem autenticação).
 *
 * Deliberadamente separado do SchedulingRepository: este caminho não pode
 * herdar, por acidente de refatoração, campos que só fazem sentido para quem
 * está logado. As consultas abaixo selecionam coluna por coluna, e o resultado
 * ainda passa pelo schema Zod antes de sair — finalidade, projeto, notas,
 * contagem de amostras e e-mail nunca são lidos.
 */
export class PostgresPublicScheduleReader {
  public constructor(private readonly pool: DatabasePool) {}

  public async listLaboratories(): Promise<readonly PublicLaboratory[]> {
    const result = await this.pool.query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name
         FROM laboratories
        WHERE archived_at IS NULL
        ORDER BY name ASC
        LIMIT 100`,
    );

    return publicLaboratoryListSchema.parse(result.rows);
  }

  public async findLaboratory(laboratoryId: string): Promise<
    { laboratory: PublicLaboratory; timezone: string } | null
  > {
    const result = await this.pool.query<{
      id: string;
      code: string;
      name: string;
      timezone: string;
    }>(
      `SELECT id, code, name, timezone
         FROM laboratories
        WHERE id = $1 AND archived_at IS NULL`,
      [laboratoryId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      laboratory: { id: row.id, code: row.code, name: row.name },
      timezone: row.timezone,
    };
  }

  public async listSchedule(query: PublicScheduleQuery): Promise<PublicScheduleResponse | null> {
    const found = await this.findLaboratory(query.laboratoryId);
    if (!found) return null;

    // Reservas vivas e bloqueios técnicos ativos. CANCELLED e RELEASED_ABSENCE
    // ficam de fora: para quem olha de fora, o horário está livre.
    const result = await this.pool.query<{
      type: 'RESERVATION' | 'TECHNICAL_BLOCK';
      equipment_name: string;
      equipment_code: string;
      starts_at: Date;
      ends_at: Date;
      status: string;
      reserved_by: string | null;
    }>(
      `SELECT 'RESERVATION'::text AS type,
              e.name  AS equipment_name,
              e.code  AS equipment_code,
              o.starts_at,
              o.ends_at,
              o.status,
              u.name  AS reserved_by
         FROM equipment_occupations o
         JOIN reservations r ON r.id = o.id
         JOIN equipment e    ON e.id = o.equipment_id
         JOIN users u        ON u.id = r.user_id
        WHERE o.laboratory_id = $1
          AND o.archived_at IS NULL
          AND r.archived_at IS NULL
          AND o.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
          AND o.period && tstzrange($2::timestamptz, $3::timestamptz, '[)')

        UNION ALL

       SELECT 'TECHNICAL_BLOCK'::text AS type,
              e.name AS equipment_name,
              e.code AS equipment_code,
              o.starts_at,
              o.ends_at,
              o.status,
              NULL   AS reserved_by
         FROM equipment_occupations o
         JOIN technical_blocks b ON b.id = o.id
         JOIN equipment e        ON e.id = o.equipment_id
        WHERE o.laboratory_id = $1
          AND o.archived_at IS NULL
          AND b.archived_at IS NULL
          AND o.status NOT IN ('CANCELLED')
          AND o.period && tstzrange($2::timestamptz, $3::timestamptz, '[)')

        ORDER BY starts_at ASC
        LIMIT ${PUBLIC_SCHEDULE_ITEM_LIMIT}`,
      [query.laboratoryId, query.startsAt, query.endsAt],
    );

    return publicScheduleResponseSchema.parse({
      laboratory: found.laboratory,
      timezone: found.timezone,
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      items: result.rows.map((row) => ({
        type: row.type,
        equipmentName: row.equipment_name,
        equipmentCode: row.equipment_code,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        inProgress: row.status === 'IN_PROGRESS',
        reservedBy: row.reserved_by,
      })),
    });
  }
}
