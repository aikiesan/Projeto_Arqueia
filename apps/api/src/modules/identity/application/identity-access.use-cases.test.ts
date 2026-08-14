import type {
  AuthenticatedPrincipal,
  Membership,
  SystemRoleAssignment,
} from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import { AuthorizationDeniedError } from '../domain/errors/authorization-denied.error.js';
import type {
  LocalIdentityAccount,
  LocalIdentityReader,
} from '../domain/ports/local-identity-reader.port.js';
import type {
  MembershipWriter,
  MembershipReader,
  SystemRoleReader,
  SystemRoleWriter,
} from '../domain/ports/membership-repository.port.js';
import type { PasswordVerifier } from '../domain/ports/password-verifier.port.js';
import { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import { ReauthenticationService } from '../domain/services/reauthentication.js';
import { AssignMembershipUseCase } from './assign-membership.use-case.js';
import { AssignSystemRoleUseCase } from './assign-system-role.use-case.js';
import { GetUserAccessUseCase } from './get-user-access.use-case.js';
import { RevokeMembershipUseCase } from './revoke-membership.use-case.js';
import { RevokeSystemRoleUseCase } from './revoke-system-role.use-case.js';

const now = '2026-08-14T00:00:00.000Z';
const actorId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const institutionId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const labA = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const targetUserId = 'e902893a-9d22-3c7e-a7b8-d6e313b71d9f';
const membershipId = '3f333df6-90a4-4fda-8dd3-9485d27cee36';
const assignmentId = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80';
const CORRECT_PASSWORD = 'current-password';
const context = { origin: 'api:http', requestId: null } as const;

function principal(role: 'USUARIO' | 'TECNICO', admin = false): AuthenticatedPrincipal {
  return {
    user: {
      id: actorId,
      institutionId,
      name: 'Pessoa Teste',
      email: 'pessoa@unicamp.br',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    memberships: [
      {
        id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
        userId: actorId,
        laboratoryId: labA,
        role,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    systemRoles: admin
      ? [
          {
            id: '6ba7b813-9dad-11d1-80b4-00c04fd430c8',
            userId: actorId,
            role: 'ADMIN',
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ]
      : [],
  };
}

const membership: Membership = {
  id: membershipId,
  userId: targetUserId,
  laboratoryId: labA,
  role: 'TECNICO',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const assignment: SystemRoleAssignment = {
  id: assignmentId,
  userId: targetUserId,
  role: 'ADMIN',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

function reauthentication(admin: AuthenticatedPrincipal): ReauthenticationService {
  const account: LocalIdentityAccount = { principal: admin, passwordHash: 'stored-hash' };
  const reader: LocalIdentityReader = {
    findActiveByEmail: vi.fn(async (email: string) =>
      email === admin.user.email ? account : null,
    ),
  };
  const verifier: PasswordVerifier = {
    verify: vi.fn(async (password: string, hash: string | null) =>
      hash !== null && password === CORRECT_PASSWORD,
    ),
  };
  return new ReauthenticationService(reader, verifier);
}

describe('Access assignment authorization and reauthentication', () => {
  const permissions = new PermissionEvaluator();

  it('lists only access returned by the administrative readers', async () => {
    const admin = principal('USUARIO', true);
    const memberships: MembershipReader = { listActiveByUser: vi.fn(async () => [membership]) };
    const systemRoles: SystemRoleReader = { listActiveByUser: vi.fn(async () => [assignment]) };

    await expect(
      new GetUserAccessUseCase(memberships, systemRoles, permissions).execute(admin, targetUserId),
    ).resolves.toEqual({ memberships: [membership], systemRoles: [assignment] });
  });

  it('denies access listing to a laboratory technician', async () => {
    const memberships: MembershipReader = { listActiveByUser: vi.fn(async () => [membership]) };
    const systemRoles: SystemRoleReader = { listActiveByUser: vi.fn(async () => [assignment]) };

    await expect(
      new GetUserAccessUseCase(memberships, systemRoles, permissions).execute(
        principal('TECNICO'),
        targetUserId,
      ),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(memberships.listActiveByUser).not.toHaveBeenCalled();
  });

  it('assigns a laboratory membership for an admin who confirms their password', async () => {
    const admin = principal('USUARIO', true);
    const assign = vi.fn(async () => membership);
    const writer: MembershipWriter = { assign, revoke: vi.fn(async () => membership) };
    const useCase = new AssignMembershipUseCase(writer, permissions, reauthentication(admin));

    await useCase.execute(
      admin,
      { userId: targetUserId, laboratoryId: labA, role: 'TECNICO', confirmationPassword: CORRECT_PASSWORD },
      context,
    );

    expect(assign).toHaveBeenCalledWith(
      { userId: targetUserId, laboratoryId: labA, role: 'TECNICO' },
      expect.objectContaining({ actorId }),
    );
  });

  it('denies membership assignment to non-administrators before touching the writer', async () => {
    const technician = principal('TECNICO');
    const assign = vi.fn(async () => membership);
    const writer: MembershipWriter = { assign, revoke: vi.fn(async () => membership) };
    const useCase = new AssignMembershipUseCase(writer, permissions, reauthentication(technician));

    await expect(
      useCase.execute(
        technician,
        { userId: targetUserId, laboratoryId: labA, role: 'TECNICO', confirmationPassword: CORRECT_PASSWORD },
        context,
      ),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(assign).not.toHaveBeenCalled();
  });

  it('rejects membership assignment when the confirmation password is wrong', async () => {
    const admin = principal('USUARIO', true);
    const assign = vi.fn(async () => membership);
    const writer: MembershipWriter = { assign, revoke: vi.fn(async () => membership) };
    const useCase = new AssignMembershipUseCase(writer, permissions, reauthentication(admin));

    await expect(
      useCase.execute(
        admin,
        { userId: targetUserId, laboratoryId: labA, role: 'TECNICO', confirmationPassword: 'wrong' },
        context,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(assign).not.toHaveBeenCalled();
  });

  it('revokes a membership by id for an admin who confirms their password', async () => {
    const admin = principal('USUARIO', true);
    const revoke = vi.fn(async () => ({ ...membership, archivedAt: now }));
    const writer: MembershipWriter = { assign: vi.fn(async () => membership), revoke };
    const useCase = new RevokeMembershipUseCase(writer, permissions, reauthentication(admin));

    await useCase.execute(admin, membershipId, { confirmationPassword: CORRECT_PASSWORD }, context);

    expect(revoke).toHaveBeenCalledWith(membershipId, expect.objectContaining({ actorId }));
  });

  it('assigns and revokes the ADMIN system role only for admins with a valid password', async () => {
    const admin = principal('USUARIO', true);
    const assign = vi.fn(async () => assignment);
    const revoke = vi.fn(async () => ({ ...assignment, archivedAt: now }));
    const writer: SystemRoleWriter = { assign, revoke };

    await new AssignSystemRoleUseCase(writer, permissions, reauthentication(admin)).execute(
      admin,
      { userId: targetUserId, role: 'ADMIN', confirmationPassword: CORRECT_PASSWORD },
      context,
    );
    expect(assign).toHaveBeenCalledWith(
      { userId: targetUserId, role: 'ADMIN' },
      expect.objectContaining({ actorId }),
    );

    await new RevokeSystemRoleUseCase(writer, permissions, reauthentication(admin)).execute(
      admin,
      assignmentId,
      { confirmationPassword: CORRECT_PASSWORD },
      context,
    );
    expect(revoke).toHaveBeenCalledWith(assignmentId, expect.objectContaining({ actorId }));
  });

  it('denies system-role assignment to non-administrators', async () => {
    const technician = principal('TECNICO');
    const assign = vi.fn(async () => assignment);
    const writer: SystemRoleWriter = { assign, revoke: vi.fn(async () => assignment) };
    const useCase = new AssignSystemRoleUseCase(writer, permissions, reauthentication(technician));

    await expect(
      useCase.execute(
        technician,
        { userId: targetUserId, role: 'ADMIN', confirmationPassword: CORRECT_PASSWORD },
        context,
      ),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(assign).not.toHaveBeenCalled();
  });
});
