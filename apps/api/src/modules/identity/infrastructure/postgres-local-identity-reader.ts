import type {
  AuthenticatedPrincipal,
  Membership,
  SystemRoleAssignment,
  User,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

import type {
  LocalIdentityAccount,
  LocalIdentityReader,
} from '../domain/ports/local-identity-reader.port.js';
import type { PrincipalReader } from '../domain/ports/principal-reader.port.js';

interface UserRow {
  id: string;
  institution_id: string;
  supervisor_user_id: string | null;
  name: string;
  email: string;
  status: User['status'];
  identity_provider: User['identityProvider'];
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface UserCredentialRow extends UserRow {
  password_hash: string;
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

export class PostgresLocalIdentityReader implements LocalIdentityReader, PrincipalReader {
  public constructor(private readonly pool: DatabasePool) {}

  public async findActiveByEmail(email: string): Promise<LocalIdentityAccount | null> {
    const userResult = await this.pool.query<UserCredentialRow>(
      `SELECT u.id, u.institution_id, u.supervisor_user_id, u.name, u.email,
              u.status, u.identity_provider, u.created_at, u.updated_at, u.archived_at,
              c.password_hash
         FROM users u
         JOIN local_credentials c ON c.user_id = u.id
        WHERE lower(u.email) = lower($1)
          AND u.archived_at IS NULL
        LIMIT 1`,
      [email],
    );
    const row = userResult.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      principal: await this.loadPrincipal(row),
      passwordHash: row.password_hash,
    };
  }

  public async findByUserId(userId: string): Promise<AuthenticatedPrincipal | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, institution_id, supervisor_user_id, name, email, status,
              identity_provider, created_at, updated_at, archived_at
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
      supervisorUserId: row.supervisor_user_id,
      name: row.name,
      email: row.email,
      status: row.status,
      identityProvider: row.identity_provider,
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
