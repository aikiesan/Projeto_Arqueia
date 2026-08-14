import type {
  CreateLaboratoryInput,
  Laboratory,
  UpdateLaboratoryInput,
} from '@arqueia/contracts';
import { inTransaction, type DatabasePool } from '@arqueia/database';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type {
  LaboratoryReader,
  LaboratoryWriter,
} from '../domain/ports/laboratory-repository.port.js';
import {
  appendMutationAudit,
  mapLaboratory,
  translateIdentityWriteError,
  type LaboratoryRow,
} from './postgres-identity-support.js';

const LABORATORY_COLUMNS = `id, institution_id, name, code, timezone,
  created_at, updated_at, archived_at`;

export class PostgresLaboratoryRepository implements LaboratoryReader, LaboratoryWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async listVisibleTo(
    laboratoryIds: readonly string[] | null,
  ): Promise<readonly Laboratory[]> {
    const visibility = laboratoryIds === null ? '' : 'AND id = ANY($1::uuid[])';
    const result = await this.pool.query<LaboratoryRow>(
      `SELECT ${LABORATORY_COLUMNS} FROM laboratories
        WHERE archived_at IS NULL ${visibility}
        ORDER BY lower(name), id`,
      laboratoryIds === null ? [] : [laboratoryIds],
    );
    return result.rows.map(mapLaboratory);
  }

  public async create(
    input: CreateLaboratoryInput,
    context: IdentityMutationContext,
  ): Promise<Laboratory> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<LaboratoryRow>(
          `INSERT INTO laboratories (institution_id, name, code, timezone)
           VALUES ($1, $2, $3, $4)
           RETURNING ${LABORATORY_COLUMNS}`,
          [input.institutionId, input.name, input.code, input.timezone ?? 'America/Sao_Paulo'],
        );
        const laboratory = mapLaboratory(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: laboratory.id,
          action: 'identity.laboratory.created',
          entity: 'Laboratory',
          entityId: laboratory.id,
          before: null,
          after: laboratory,
        });
        return laboratory;
      });
    } catch (error) {
      return translateIdentityWriteError(error);
    }
  }

  public async update(
    laboratoryId: string,
    input: UpdateLaboratoryInput,
    context: IdentityMutationContext,
  ): Promise<Laboratory> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<LaboratoryRow>(
          `SELECT ${LABORATORY_COLUMNS} FROM laboratories
            WHERE id = $1 AND archived_at IS NULL FOR UPDATE`,
          [laboratoryId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) {
          throw new IdentityEntityNotFoundError('Laboratory', laboratoryId);
        }
        const result = await client.query<LaboratoryRow>(
          `UPDATE laboratories SET
             name = CASE WHEN $2::boolean THEN $3 ELSE name END,
             code = CASE WHEN $4::boolean THEN $5 ELSE code END,
             timezone = CASE WHEN $6::boolean THEN $7 ELSE timezone END
           WHERE id = $1 AND archived_at IS NULL
           RETURNING ${LABORATORY_COLUMNS}`,
          [
            laboratoryId,
            'name' in input,
            input.name ?? null,
            'code' in input,
            input.code ?? null,
            'timezone' in input,
            input.timezone ?? null,
          ],
        );
        const before = mapLaboratory(beforeRow);
        const after = mapLaboratory(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId,
          action: 'identity.laboratory.updated',
          entity: 'Laboratory',
          entityId: laboratoryId,
          before,
          after,
        });
        return after;
      });
    } catch (error) {
      if (error instanceof IdentityEntityNotFoundError) throw error;
      return translateIdentityWriteError(error);
    }
  }
}
