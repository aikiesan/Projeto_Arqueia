import type {
  AuthenticatedPrincipal,
  Membership,
  SystemRoleAssignment,
  User,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

import type {
  CurrentCredential,
  CurrentCredentialReader,
} from '../domain/ports/current-credential-reader.port.js';
import type {
  LocalIdentityAccount,
  LocalIdentityReader,
} from '../domain/ports/local-identity-reader.port.js';
import type { PrincipalReader } from '../domain/ports/principal-reader.port.js';

interface UserRow {
  id: string;
  institution_id: string;
  login_code: string;
  academic_category: User['academicCategory'];
  status: User['status'];
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface UserCredentialRow extends UserRow {
  password_hash: string;
  failed_attempts: number;
  locked_until: Date | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  laboratory_id: string;
  role: Membership['role'];
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface SystemRoleRow {
  id: string;
  user_id: string;
  role: SystemRoleAssignment['role'];
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

function timestamp(value: Date): string {
  return value.toISOString();
}

export class PostgresLocalIdentityReader
  implements LocalIdentityReader, CurrentCredentialReader, PrincipalReader
{
  public constructor(private readonly pool: DatabasePool) {}

  public async findActiveByLoginCode(loginCode: string): Promise<LocalIdentityAccount | null> {
    const userResult = await this.pool.query<UserCredentialRow>(
      `SELECT u.id, u.institution_id, u.login_code, u.academic_category,
              u.status, u.must_change_password, u.created_at, u.updated_at, u.archived_at,
              c.password_hash, c.failed_attempts, c.locked_until
         FROM users u
         JOIN local_credentials c ON c.user_id = u.id
        WHERE upper(u.login_code) = upper($1)
          AND u.archived_at IS NULL
        LIMIT 1`,
      [loginCode],
    );
    const row = userResult.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      principal: await this.loadPrincipal(row),
      passwordHash: row.password_hash,
      failedAttempts: row.failed_attempts ?? 0,
      lockedUntil: row.locked_until ? row.locked_until.toISOString() : null,
    };
  }

  public async findActiveById(userId: string): Promise<LocalIdentityAccount | null> {
    const userResult = await this.pool.query<UserCredentialRow>(
      `SELECT u.id, u.institution_id, u.login_code, u.academic_category,
              u.status, u.must_change_password, u.created_at, u.updated_at, u.archived_at,
              c.password_hash, c.failed_attempts, c.locked_until
         FROM users u
         JOIN local_credentials c ON c.user_id = u.id
        WHERE u.id = $1
          AND u.archived_at IS NULL
        LIMIT 1`,
      [userId],
    );
    const row = userResult.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      principal: await this.loadPrincipal(row),
      passwordHash: row.password_hash,
      failedAttempts: row.failed_attempts ?? 0,
      lockedUntil: row.locked_until ? row.locked_until.toISOString() : null,
    };
  }

  public async recordLoginSuccess(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE local_credentials
          SET failed_attempts = 0,
              locked_until = NULL,
              updated_at = now()
        WHERE user_id = $1`,
      [userId],
    );
  }

  public async recordLoginFailure(
    userId: string,
    maxFailedAttempts: number,
    lockoutDurationSeconds: number,
  ): Promise<{ failedAttempts: number; isLocked: boolean; lockedUntil: string | null }> {
    const result = await this.pool.query<{ failed_attempts: number; locked_until: Date | null }>(
      `UPDATE local_credentials
          SET failed_attempts = failed_attempts + 1,
              locked_until = CASE
                WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' seconds')::interval
                ELSE locked_until
              END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING failed_attempts, locked_until`,
      [userId, maxFailedAttempts, lockoutDurationSeconds],
    );
    const updated = result.rows[0];
    const isLocked = updated?.locked_until !== null && updated?.locked_until !== undefined;
    return {
      failedAttempts: updated?.failed_attempts ?? 1,
      isLocked,
      lockedUntil: updated?.locked_until ? updated.locked_until.toISOString() : null,
    };
  }

  public async findActiveByUserId(userId: string): Promise<CurrentCredential | null> {
    const result = await this.pool.query<{ password_hash: string }>(
      `SELECT c.password_hash
         FROM users u
         JOIN local_credentials c ON c.user_id = u.id
        WHERE u.id = $1
          AND u.status = 'ACTIVE'
          AND u.archived_at IS NULL
        LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    return row === undefined ? null : { passwordHash: row.password_hash };
  }

  public async findByUserId(userId: string): Promise<AuthenticatedPrincipal | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, institution_id, login_code, academic_category, status,
              must_change_password, created_at, updated_at, archived_at
         FROM users
        WHERE id = $1 AND archived_at IS NULL
        LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    return row === undefined ? null : this.loadPrincipal(row);
  }

  private async loadPrincipal(row: UserRow): Promise<AuthenticatedPrincipal> {
    const [membershipsResult, systemRolesResult] = await Promise.all([
      this.pool.query<MembershipRow>(
        `SELECT id, user_id, laboratory_id, role, created_at, updated_at, archived_at
           FROM memberships
          WHERE user_id = $1 AND archived_at IS NULL`,
        [row.id],
      ),
      this.pool.query<SystemRoleRow>(
        `SELECT id, user_id, role, created_at, updated_at, archived_at
           FROM system_role_assignments
          WHERE user_id = $1 AND archived_at IS NULL`,
        [row.id],
      ),
    ]);

    const user: User = {
      id: row.id,
      institutionId: row.institution_id,
      loginCode: row.login_code,
      academicCategory: row.academic_category,
      status: row.status,
      mustChangePassword: row.must_change_password,
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
      archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
    };
    const memberships: Membership[] = membershipsResult.rows.map((membership) => ({
      id: membership.id,
      userId: membership.user_id,
      laboratoryId: membership.laboratory_id,
      role: membership.role,
      createdAt: timestamp(membership.created_at),
      updatedAt: timestamp(membership.updated_at),
      archivedAt:
        membership.archived_at === null ? null : timestamp(membership.archived_at),
    }));
    const systemRoles: SystemRoleAssignment[] = systemRolesResult.rows.map((assignment) => ({
      id: assignment.id,
      userId: assignment.user_id,
      role: assignment.role,
      createdAt: timestamp(assignment.created_at),
      updatedAt: timestamp(assignment.updated_at),
      archivedAt: assignment.archived_at === null ? null : timestamp(assignment.archived_at),
    }));
    return { user, memberships, systemRoles };
  }
}
