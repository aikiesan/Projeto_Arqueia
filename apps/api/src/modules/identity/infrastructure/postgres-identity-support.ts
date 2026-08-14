import type {
  Laboratory,
  Membership,
  Project,
  SystemRoleAssignment,
  User,
} from '@arqueia/contracts';
import type { DatabaseClient } from '@arqueia/database';

import { IdentityConflictError } from '../domain/errors/identity-conflict.error.js';
import type { IdentityMutationContext } from '../domain/ports/identity-mutation-context.js';

export interface UserRow {
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

export interface LaboratoryRow {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

export interface ProjectRow {
  id: string;
  laboratory_id: string;
  code: string;
  name: string;
  description: string | null;
  status: Project['status'];
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

export interface MembershipRow {
  id: string;
  user_id: string;
  laboratory_id: string;
  role: Membership['role'];
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

export interface SystemRoleAssignmentRow {
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

export function mapUser(row: UserRow): User {
  return {
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
}

export function mapLaboratory(row: LaboratoryRow): Laboratory {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    code: row.code,
    timezone: row.timezone,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  };
}

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    laboratoryId: row.laboratory_id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  };
}

export function mapMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    laboratoryId: row.laboratory_id,
    role: row.role,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  };
}

export function mapSystemRoleAssignment(row: SystemRoleAssignmentRow): SystemRoleAssignment {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  };
}

export async function appendMutationAudit(
  client: DatabaseClient,
  context: IdentityMutationContext,
  input: {
    readonly laboratoryId: string | null;
    readonly action: string;
    readonly entity: 'User' | 'Laboratory' | 'Project' | 'Membership' | 'SystemRoleAssignment';
    readonly entityId: string;
    readonly before: unknown | null;
    readonly after: unknown;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       actor_id, laboratory_id, action, entity, entity_id,
       before, after, origin, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      context.actorId,
      input.laboratoryId,
      input.action,
      input.entity,
      input.entityId,
      input.before === null ? null : JSON.stringify(input.before),
      JSON.stringify(input.after),
      context.origin,
      context.requestId,
    ],
  );
}

export function translateIdentityWriteError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === '23505' || error.code === '23503')
  ) {
    throw new IdentityConflictError();
  }

  throw error;
}
