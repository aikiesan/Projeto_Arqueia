import type {
  CreateMembershipInput,
  CreateSystemRoleAssignmentInput,
  Membership,
  SystemRoleAssignment,
} from '@arqueia/contracts';
import { inTransaction, type DatabasePool } from '@arqueia/database';

import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';
import type {
  MembershipWriter,
  MembershipReader,
  SystemRoleReader,
  SystemRoleWriter,
} from '../domain/ports/membership-repository.port.js';
import {
  appendMutationAudit,
  mapMembership,
  mapSystemRoleAssignment,
  translateIdentityWriteError,
  type MembershipRow,
  type SystemRoleAssignmentRow,
} from './postgres-identity-support.js';

const MEMBERSHIP_COLUMNS = `id, user_id, laboratory_id, role, created_at, updated_at, archived_at`;
const SYSTEM_ROLE_COLUMNS = `id, user_id, role, created_at, updated_at, archived_at`;

export class PostgresMembershipRepository implements MembershipReader, MembershipWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async listActiveByUser(userId: string): Promise<readonly Membership[]> {
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM memberships
        WHERE user_id = $1 AND archived_at IS NULL
        ORDER BY laboratory_id, role, id`,
      [userId],
    );
    return result.rows.map(mapMembership);
  }

  public async assign(
    input: CreateMembershipInput,
    context: IdentityMutationContext,
  ): Promise<Membership> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<MembershipRow>(
          `INSERT INTO memberships (user_id, laboratory_id, role)
           VALUES ($1, $2, $3)
           RETURNING ${MEMBERSHIP_COLUMNS}`,
          [input.userId, input.laboratoryId, input.role],
        );
        const membership = mapMembership(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: membership.laboratoryId,
          action: 'identity.membership.assigned',
          entity: 'Membership',
          entityId: membership.id,
          before: null,
          after: membership,
        });
        return membership;
      });
    } catch (error) {
      return translateIdentityWriteError(error);
    }
  }

  public async revoke(
    membershipId: string,
    context: IdentityMutationContext,
  ): Promise<Membership> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<MembershipRow>(
          `SELECT ${MEMBERSHIP_COLUMNS} FROM memberships
            WHERE id = $1 AND archived_at IS NULL
            FOR UPDATE`,
          [membershipId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) {
          throw new IdentityEntityNotFoundError('Membership', membershipId);
        }

        const result = await client.query<MembershipRow>(
          `UPDATE memberships SET archived_at = now()
            WHERE id = $1 AND archived_at IS NULL
            RETURNING ${MEMBERSHIP_COLUMNS}`,
          [membershipId],
        );
        const before = mapMembership(beforeRow);
        const after = mapMembership(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: after.laboratoryId,
          action: 'identity.membership.revoked',
          entity: 'Membership',
          entityId: membershipId,
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

export class PostgresSystemRoleRepository implements SystemRoleReader, SystemRoleWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async listActiveByUser(userId: string): Promise<readonly SystemRoleAssignment[]> {
    const result = await this.pool.query<SystemRoleAssignmentRow>(
      `SELECT ${SYSTEM_ROLE_COLUMNS} FROM system_role_assignments
        WHERE user_id = $1 AND archived_at IS NULL
        ORDER BY role, id`,
      [userId],
    );
    return result.rows.map(mapSystemRoleAssignment);
  }

  public async assign(
    input: CreateSystemRoleAssignmentInput,
    context: IdentityMutationContext,
  ): Promise<SystemRoleAssignment> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<SystemRoleAssignmentRow>(
          `INSERT INTO system_role_assignments (user_id, role)
           VALUES ($1, $2)
           RETURNING ${SYSTEM_ROLE_COLUMNS}`,
          [input.userId, input.role],
        );
        const assignment = mapSystemRoleAssignment(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: null,
          action: 'identity.system_role.assigned',
          entity: 'SystemRoleAssignment',
          entityId: assignment.id,
          before: null,
          after: assignment,
        });
        return assignment;
      });
    } catch (error) {
      return translateIdentityWriteError(error);
    }
  }

  public async revoke(
    assignmentId: string,
    context: IdentityMutationContext,
  ): Promise<SystemRoleAssignment> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const beforeResult = await client.query<SystemRoleAssignmentRow>(
          `SELECT ${SYSTEM_ROLE_COLUMNS} FROM system_role_assignments
            WHERE id = $1 AND archived_at IS NULL
            FOR UPDATE`,
          [assignmentId],
        );
        const beforeRow = beforeResult.rows[0];
        if (beforeRow === undefined) {
          throw new IdentityEntityNotFoundError('SystemRoleAssignment', assignmentId);
        }

        const result = await client.query<SystemRoleAssignmentRow>(
          `UPDATE system_role_assignments SET archived_at = now()
            WHERE id = $1 AND archived_at IS NULL
            RETURNING ${SYSTEM_ROLE_COLUMNS}`,
          [assignmentId],
        );
        const before = mapSystemRoleAssignment(beforeRow);
        const after = mapSystemRoleAssignment(result.rows[0]!);
        await appendMutationAudit(client, context, {
          laboratoryId: null,
          action: 'identity.system_role.revoked',
          entity: 'SystemRoleAssignment',
          entityId: assignmentId,
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
