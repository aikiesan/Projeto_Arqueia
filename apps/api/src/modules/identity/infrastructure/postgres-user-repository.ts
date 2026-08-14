import type { UpdateUserInput, User } from '@arqueia/contracts';
import { inTransaction, type DatabasePool } from '@arqueia/database';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type {
  CreateUserRecord,
  UserReader,
  UserWriter,
} from '../domain/ports/user-repository.port.js';
import {
  appendMutationAudit,
  mapUser,
  translateIdentityWriteError,
  type UserRow,
} from './postgres-identity-support.js';

const USER_COLUMNS = `id, institution_id, supervisor_user_id, name, email, status,
  identity_provider, created_at, updated_at, archived_at`;

export class PostgresUserRepository implements UserReader, UserWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async listVisibleTo(laboratoryIds: readonly string[] | null): Promise<readonly User[]> {
    const visibility =
      laboratoryIds === null
        ? ''
        : `AND EXISTS (
             SELECT 1 FROM memberships m
              WHERE m.user_id = u.id
                AND m.archived_at IS NULL
                AND m.laboratory_id = ANY($1::uuid[])
           )`;
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u
        WHERE u.archived_at IS NULL ${visibility}
        ORDER BY lower(u.name), u.id`,
      laboratoryIds === null ? [] : [laboratoryIds],
    );
    return result.rows.map(mapUser);
  }

  public async create(
    input: CreateUserRecord,
    passwordHash: string | null,
    context: IdentityMutationContext,
  ): Promise<User> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<UserRow>(
          `INSERT INTO users (
             institution_id, supervisor_user_id, name, email, status, identity_provider
           ) VALUES ($1, $2, $3, $4, 'INVITED', 'LOCAL')
           RETURNING ${USER_COLUMNS}`,
          [input.institutionId, input.supervisorUserId ?? null, input.name, input.email],
        );
        const user = mapUser(result.rows[0]!);

        if (passwordHash !== null) {
          await client.query(
            `INSERT INTO local_credentials (user_id, password_hash) VALUES ($1, $2)`,
            [user.id, passwordHash],
          );
        }

        await appendMutationAudit(client, context, {
          laboratoryId: null,
          action: 'identity.user.created',
          entity: 'User',
          entityId: user.id,
          before: null,
          after: user,
        });
        return user;
      });
    } catch (error) {
      return translateIdentityWriteError(error);
    }
  }

  public async update(
    userId: string,
    input: UpdateUserInput,
    context: IdentityMutationContext,
  ): Promise<User> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<UserRow>(
          `SELECT ${USER_COLUMNS} FROM users
            WHERE id = $1 AND archived_at IS NULL
            FOR UPDATE`,
          [userId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) {
          throw new IdentityEntityNotFoundError('User', userId);
        }

        const result = await client.query<UserRow>(
          `UPDATE users SET
             name = CASE WHEN $2::boolean THEN $3 ELSE name END,
             email = CASE WHEN $4::boolean THEN $5 ELSE email END,
             supervisor_user_id = CASE WHEN $6::boolean THEN $7::uuid ELSE supervisor_user_id END,
             status = CASE WHEN $8::boolean THEN $9 ELSE status END
           WHERE id = $1 AND archived_at IS NULL
           RETURNING ${USER_COLUMNS}`,
          [
            userId,
            'name' in input,
            input.name ?? null,
            'email' in input,
            input.email ?? null,
            'supervisorUserId' in input,
            input.supervisorUserId ?? null,
            'status' in input,
            input.status ?? null,
          ],
        );
        const before = mapUser(beforeRow);
        const after = mapUser(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: null,
          action: 'identity.user.updated',
          entity: 'User',
          entityId: userId,
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
