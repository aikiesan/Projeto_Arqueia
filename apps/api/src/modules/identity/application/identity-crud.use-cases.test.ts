import type {
  AuthenticatedPrincipal,
  Laboratory,
  Project,
  User,
} from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../domain/errors/authorization-denied.error.js';
import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import type { LaboratoryReader } from '../domain/ports/laboratory-repository.port.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';
import type {
  ProjectReader,
  ProjectWriter,
} from '../domain/ports/project-repository.port.js';
import type { UserReader, UserWriter } from '../domain/ports/user-repository.port.js';
import { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import { CreateLaboratoryUseCase } from './create-laboratory.use-case.js';
import { CreateProjectUseCase } from './create-project.use-case.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { ListLaboratoriesUseCase } from './list-laboratories.use-case.js';
import { ListUsersUseCase } from './list-users.use-case.js';
import { UpdateProjectUseCase } from './update-project.use-case.js';

const now = '2026-08-14T00:00:00.000Z';
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const institutionId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const labA = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const labB = 'e902893a-9d22-3c7e-a7b8-d6e313b71d9f';
const projectId = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';
const context = { origin: 'api:http', requestId: null } as const;

function principal(role: 'USUARIO' | 'TECNICO', admin = false): AuthenticatedPrincipal {
  return {
    user: {
      id: userId,
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
        userId,
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
            userId,
            role: 'ADMIN',
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ]
      : [],
  };
}

const user: User = principal('USUARIO').user;
const laboratory: Laboratory = {
  id: labA,
  institutionId,
  name: 'Laboratório A',
  code: 'LAB-A',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};
const project: Project = {
  id: projectId,
  laboratoryId: labA,
  code: 'P-001',
  name: 'Projeto A',
  description: null,
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

describe('Identity CRUD authorization and scope', () => {
  const permissions = new PermissionEvaluator();

  it('limits laboratory listings to active memberships for non-admin users', async () => {
    const listVisibleTo = vi.fn(async () => [laboratory]);
    const reader: LaboratoryReader = { listVisibleTo };

    await new ListLaboratoriesUseCase(reader, permissions).execute(principal('USUARIO'));

    expect(listVisibleTo).toHaveBeenCalledWith([labA]);
  });

  it('lets administrators list all users and limits technicians to their laboratories', async () => {
    const listVisibleTo = vi.fn(async () => [user]);
    const reader: UserReader = { listVisibleTo };
    const useCase = new ListUsersUseCase(reader, permissions);

    await useCase.execute(principal('USUARIO', true));
    await useCase.execute(principal('TECNICO'));

    expect(listVisibleTo).toHaveBeenNthCalledWith(1, null);
    expect(listVisibleTo).toHaveBeenNthCalledWith(2, [labA]);
  });

  it('denies user listings to ordinary laboratory users', async () => {
    const listVisibleTo = vi.fn(async () => [user]);
    const useCase = new ListUsersUseCase({ listVisibleTo }, permissions);

    await expect(useCase.execute(principal('USUARIO'))).rejects.toBeInstanceOf(
      AuthorizationDeniedError,
    );
    expect(listVisibleTo).not.toHaveBeenCalled();
  });

  it('allows a technician to create projects only in their own laboratory', () => {
    const create = vi.fn(async () => project);
    const writer: ProjectWriter = { create, update: vi.fn(async () => project) };
    const useCase = new CreateProjectUseCase(writer, permissions);

    void useCase.execute(
      principal('TECNICO'),
      { laboratoryId: labA, code: 'P-001', name: 'Projeto A' },
      context,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ laboratoryId: labA }),
      expect.objectContaining({ actorId: userId }),
    );
    expect(() =>
      useCase.execute(
        principal('TECNICO'),
        { laboratoryId: labB, code: 'P-002', name: 'Projeto B' },
        context,
      ),
    ).toThrow(AuthorizationDeniedError);
  });

  it('authorizes project updates from the persisted laboratory scope', async () => {
    const findActiveById = vi.fn(async () => project);
    const update = vi.fn(async () => ({ ...project, name: 'Atualizado' }));
    const reader: ProjectReader = { listVisibleTo: vi.fn(async () => []), findActiveById };
    const writer: ProjectWriter = { create: vi.fn(async () => project), update };
    const useCase = new UpdateProjectUseCase(reader, writer, permissions);

    await useCase.execute(principal('TECNICO'), projectId, { name: 'Atualizado' }, context);

    expect(update).toHaveBeenCalledWith(
      projectId,
      { name: 'Atualizado' },
      expect.objectContaining({ actorId: userId }),
    );
  });

  it('does not authorize an update when the project does not exist', async () => {
    const reader: ProjectReader = {
      listVisibleTo: vi.fn(async () => []),
      findActiveById: vi.fn(async () => null),
    };
    const writer: ProjectWriter = {
      create: vi.fn(async () => project),
      update: vi.fn(async () => project),
    };

    await expect(
      new UpdateProjectUseCase(reader, writer, permissions).execute(
        principal('TECNICO'),
        projectId,
        { name: 'Atualizado' },
        context,
      ),
    ).rejects.toBeInstanceOf(IdentityEntityNotFoundError);
    expect(writer.update).not.toHaveBeenCalled();
  });

  it('hashes temporary passwords and delegates user creation only for admins', async () => {
    const create = vi.fn(async () => user);
    const writer: UserWriter = { create, update: vi.fn(async () => user) };
    const hasher: PasswordHasher = { hash: vi.fn(async () => 'password-hash') };
    const useCase = new CreateUserUseCase(writer, hasher, permissions);
    const input = {
      institutionId,
      name: 'Nova Pessoa',
      email: 'nova@unicamp.br',
      temporaryPassword: 'temporary-secret',
    };

    await useCase.execute(principal('USUARIO', true), input, context);

    expect(hasher.hash).toHaveBeenCalledWith('temporary-secret');
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ temporaryPassword: expect.anything() }),
      'password-hash',
      expect.objectContaining({ actorId: userId }),
    );
    await expect(useCase.execute(principal('TECNICO'), input, context)).rejects.toBeInstanceOf(
      AuthorizationDeniedError,
    );
  });

  it('reserves laboratory mutations for global administrators', () => {
    const create = vi.fn(async () => laboratory);
    const useCase = new CreateLaboratoryUseCase(
      { create, update: vi.fn(async () => laboratory) },
      permissions,
    );

    expect(() =>
      useCase.execute(
        principal('TECNICO'),
        { institutionId, name: 'Laboratório B', code: 'LAB-B' },
        context,
      ),
    ).toThrow(AuthorizationDeniedError);
    void useCase.execute(
      principal('USUARIO', true),
      { institutionId, name: 'Laboratório B', code: 'LAB-B' },
      context,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});
