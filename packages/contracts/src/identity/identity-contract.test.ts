import { describe, expect, it } from 'vitest';

import {
  assignMembershipRequestSchema,
  assignSystemRoleRequestSchema,
  createLaboratoryInputSchema,
  createMembershipInputSchema,
  createSystemRoleAssignmentInputSchema,
  createUserInputSchema,
  localLoginInputSchema,
  revokeAccessRequestSchema,
  userAccessQuerySchema,
  userAccessSnapshotSchema,
  userSchema,
} from '../index.js';

const uuid = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const otherUuid = 'e902893a-9d22-3c7e-a7b8-d6e313b71d9f';

describe('identity contract', () => {
  it('validates an access snapshot without accepting credential fields', () => {
    expect(userAccessQuerySchema.parse({ userId: uuid })).toEqual({ userId: uuid });
    expect(userAccessSnapshotSchema.parse({ memberships: [], systemRoles: [] })).toEqual({
      memberships: [],
      systemRoles: [],
    });
    expect(() =>
      userAccessSnapshotSchema.parse({ memberships: [], systemRoles: [], passwordHash: 'secret' }),
    ).toThrow();
  });

  it('normalizes e-mail and laboratory code at the boundary', () => {
    const user = createUserInputSchema.parse({
      institutionId: uuid,
      name: '  Ana Pesquisadora  ',
      email: '  Ana@UNICAMP.BR ',
    });
    const laboratory = createLaboratoryInputSchema.parse({
      institutionId: uuid,
      name: 'CP2b',
      code: 'cp2b-lab',
    });

    expect(user).toMatchObject({
      name: 'Ana Pesquisadora',
      email: 'ana@unicamp.br',
      supervisorUserId: null,
    });
    expect(laboratory).toMatchObject({
      code: 'CP2b-LAB',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('keeps ADMIN out of laboratory memberships', () => {
    expect(() =>
      createMembershipInputSchema.parse({
        userId: uuid,
        laboratoryId: otherUuid,
        role: 'ADMIN',
      }),
    ).toThrow();
  });

  it('keeps laboratory roles out of system assignments', () => {
    expect(() =>
      createSystemRoleAssignmentInputSchema.parse({ userId: uuid, role: 'TECNICO' }),
    ).toThrow();
  });

  it('does not accept credentials in the public User representation', () => {
    const result = userSchema.safeParse({
      id: uuid,
      institutionId: otherUuid,
      name: 'Ana Pesquisadora',
      email: 'ana@unicamp.br',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      passwordHash: 'must-not-cross-the-boundary',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    });

    expect(result.success).toBe(false);
  });

  it('normalizes local-login e-mail without weakening password validation', () => {
    expect(
      localLoginInputSchema.parse({ email: 'ADMIN@UNICAMP.BR', password: 'valid-password' }),
    ).toEqual({ email: 'admin@unicamp.br', password: 'valid-password' });
    expect(() => localLoginInputSchema.parse({ email: 'admin@unicamp.br', password: '' })).toThrow();
  });

  it('requires reauthentication for access-assignment requests', () => {
    expect(
      assignMembershipRequestSchema.parse({
        userId: uuid,
        laboratoryId: otherUuid,
        role: 'TECNICO',
        confirmationPassword: 'current-password',
      }),
    ).toMatchObject({ role: 'TECNICO', confirmationPassword: 'current-password' });

    expect(() =>
      assignMembershipRequestSchema.parse({
        userId: uuid,
        laboratoryId: otherUuid,
        role: 'TECNICO',
      }),
    ).toThrow();

    expect(
      assignSystemRoleRequestSchema.parse({
        userId: uuid,
        role: 'ADMIN',
        confirmationPassword: 'current-password',
      }),
    ).toMatchObject({ role: 'ADMIN' });

    expect(revokeAccessRequestSchema.parse({ confirmationPassword: 'x' })).toEqual({
      confirmationPassword: 'x',
    });
    expect(() => revokeAccessRequestSchema.parse({})).toThrow();
  });
});
