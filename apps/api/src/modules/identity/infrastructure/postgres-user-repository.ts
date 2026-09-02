import type { UpdateUserInput, User } from '@arqueia/contracts';
import { inTransaction, type DatabasePool } from '@arqueia/database';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type { UserCredentialWriter } from '../domain/ports/user-credential-writer.port.js';
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

const USER_COLUMNS = `id, institution_id, login_code, academic_category, status,
  must_change_password, created_at, updated_at, archived_at`;

export class PostgresUserRepository implements UserReader, UserWriter, UserCredentialWriter {
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
        ORDER BY u.login_code, u.id`,
      laboratoryIds === null ? [] : [laboratoryIds],
    );
    return result.rows.map(mapUser);
  }

  public async create(
    input: CreateUserRecord,
    passwordHash: string,
    context: IdentityMutationContext,
  ): Promise<User> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<UserRow>(
          `INSERT INTO users (
             institution_id, login_code, academic_category, status, must_change_password
           ) VALUES ($1, 'ARQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
                     $2, 'ACTIVE', true)
           RETURNING ${USER_COLUMNS}`,
          [input.institutionId, input.academicCategory],
        );
        const user = mapUser(result.rows[0]!);

        await client.query(
          `INSERT INTO local_credentials (user_id, password_hash) VALUES ($1, $2)`,
          [user.id, passwordHash],
        );

        await client.query(
          `INSERT INTO memberships (user_id, laboratory_id, role)
           VALUES ($1, $2, 'USUARIO')`,
          [user.id, input.laboratoryId],
        );

        await appendMutationAudit(client, context, {
          laboratoryId: input.laboratoryId,
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
             academic_category = CASE WHEN $2::boolean THEN $3 ELSE academic_category END,
             status = CASE WHEN $4::boolean THEN $5 ELSE status END
           WHERE id = $1 AND archived_at IS NULL
           RETURNING ${USER_COLUMNS}`,
          [
            userId,
            'academicCategory' in input,
            input.academicCategory ?? null,
            'status' in input,
            input.status ?? null,
          ],
        );
        const before = mapUser(beforeRow);
        const after = mapUser(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: input.laboratoryId,
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

  public async setPasswordHash(
    userId: string,
    passwordHash: string,
    context: IdentityMutationContext,
    action: 'identity.user.password_changed' | 'identity.user.password_reset_by_admin',
  ): Promise<void> {
    try {
      await inTransaction(this.pool, async (client) => {
        const userResult = await client.query<{ id: string }>(
          `SELECT id
             FROM users
            WHERE id = $1
              AND status = 'ACTIVE'
              AND archived_at IS NULL
            FOR UPDATE`,
          [userId],
        );
        if (userResult.rows[0] === undefined) {
          throw new IdentityEntityNotFoundError('User', userId);
        }

        await client.query(
          `INSERT INTO local_credentials (user_id, password_hash)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET
             password_hash = EXCLUDED.password_hash,
             failed_attempts = 0,
             locked_until = NULL,
             updated_at = now()`,
          [userId, passwordHash],
        );

        await client.query(
          `UPDATE users
              SET must_change_password = $2,
                  updated_at = now()
            WHERE id = $1`,
          [userId, action === 'identity.user.password_reset_by_admin'],
        );

        await appendMutationAudit(client, context, {
          laboratoryId: null,
          action,
          entity: 'User',
          entityId: userId,
          before: null,
          after: { credentialUpdated: true, userId },
        });
      });
    } catch (error) {
      if (error instanceof IdentityEntityNotFoundError) throw error;
      return translateIdentityWriteError(error);
    }
  }
}
