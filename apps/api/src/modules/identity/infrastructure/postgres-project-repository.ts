import type { CreateProjectInput, Project, UpdateProjectInput } from '@arqueia/contracts';
import { inTransaction, type DatabasePool } from '@arqueia/database';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type {
  ProjectReader,
  ProjectWriter,
} from '../domain/ports/project-repository.port.js';
import {
  appendMutationAudit,
  mapProject,
  translateIdentityWriteError,
  type ProjectRow,
} from './postgres-identity-support.js';

const PROJECT_COLUMNS = `id, laboratory_id, code, name, description, status,
  created_at, updated_at, archived_at`;

export class PostgresProjectRepository implements ProjectReader, ProjectWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async listVisibleTo(laboratoryIds: readonly string[] | null): Promise<readonly Project[]> {
    const visibility = laboratoryIds === null ? '' : 'AND laboratory_id = ANY($1::uuid[])';
    const result = await this.pool.query<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM projects
        WHERE archived_at IS NULL ${visibility}
        ORDER BY lower(name), id`,
      laboratoryIds === null ? [] : [laboratoryIds],
    );
    return result.rows.map(mapProject);
  }

  public async findActiveById(projectId: string): Promise<Project | null> {
    const result = await this.pool.query<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM projects
        WHERE id = $1 AND archived_at IS NULL LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapProject(row);
  }

  public async create(
    input: CreateProjectInput,
    context: IdentityMutationContext,
  ): Promise<Project> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<ProjectRow>(
          `INSERT INTO projects (laboratory_id, code, name, description, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           RETURNING ${PROJECT_COLUMNS}`,
          [input.laboratoryId, input.code, input.name, input.description ?? null],
        );
        const project = mapProject(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: project.laboratoryId,
          action: 'identity.project.created',
          entity: 'Project',
          entityId: project.id,
          before: null,
          after: project,
        });
        return project;
      });
    } catch (error) {
      return translateIdentityWriteError(error);
    }
  }

  public async update(
    projectId: string,
    input: UpdateProjectInput,
    context: IdentityMutationContext,
  ): Promise<Project> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<ProjectRow>(
          `SELECT ${PROJECT_COLUMNS} FROM projects
            WHERE id = $1 AND archived_at IS NULL FOR UPDATE`,
          [projectId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) {
          throw new IdentityEntityNotFoundError('Project', projectId);
        }
        const result = await client.query<ProjectRow>(
          `UPDATE projects SET
             code = CASE WHEN $2::boolean THEN $3 ELSE code END,
             name = CASE WHEN $4::boolean THEN $5 ELSE name END,
             description = CASE WHEN $6::boolean THEN $7 ELSE description END,
             status = CASE WHEN $8::boolean THEN $9 ELSE status END
           WHERE id = $1 AND archived_at IS NULL
           RETURNING ${PROJECT_COLUMNS}`,
          [
            projectId,
            'code' in input,
            input.code ?? null,
            'name' in input,
            input.name ?? null,
            'description' in input,
            input.description ?? null,
            'status' in input,
            input.status ?? null,
          ],
        );
        const before = mapProject(beforeRow);
        const after = mapProject(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: after.laboratoryId,
          action: 'identity.project.updated',
          entity: 'Project',
          entityId: projectId,
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
