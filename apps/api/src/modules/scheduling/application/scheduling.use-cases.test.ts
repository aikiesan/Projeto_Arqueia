import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { CancelReservationUseCase } from './cancel-reservation.use-case.js';
import { CreateReservationUseCase } from './create-reservation.use-case.js';
import { ListScheduleUseCase } from './list-schedule.use-case.js';
import type { SchedulingRepository } from '../domain/ports/scheduling-repository.port.js';
import { SchedulingStartsInPastError } from '../domain/scheduling.errors.js';

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const reservationId = '22222222-2222-4222-a222-222222222222';
const userId = '33333333-3333-4333-a333-333333333333';
const metadata = {
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  archivedAt: null,
} as const;

function principal(role: 'USUARIO' | 'TECNICO' | 'RESPONSAVEL_CONTROLADOS'): AuthenticatedPrincipal {
  return {
    user: {
      ...metadata,
      id: userId,
      institutionId: '44444444-4444-4444-a444-444444444444',
      name: 'Pesquisador CP2b',
      email: 'pesquisador@arqueia.local',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
    },
    memberships: [
      {
        ...metadata,
        id: '55555555-5555-4555-a555-555555555555',
        userId,
        laboratoryId,
        role,
      },
    ],
    systemRoles: [],
  };
}

describe('Scheduling use cases', () => {
  let repository: SchedulingRepository;
  let permissions: PermissionEvaluator;

  beforeEach(() => {
    repository = {
      createReservation: vi.fn(),
      cancelReservation: vi.fn(),
      createTechnicalBlock: vi.fn(),
      cancelTechnicalBlock: vi.fn(),
      listSchedule: vi.fn().mockResolvedValue({
        laboratoryId,
        timezone: 'America/Sao_Paulo',
        startsAt: '2026-08-14T03:00:00.000Z',
        endsAt: '2026-08-15T03:00:00.000Z',
        capabilities: { canReserve: true, canManageBlocks: false },
        items: [],
      }),
    };
    permissions = new PermissionEvaluator();
  });

  it('derives user capabilities on the server without exposing role interpretation to the client', async () => {
    const useCase = new ListScheduleUseCase(repository, permissions);
    const query = {
      laboratoryId,
      startsAt: '2026-08-14T03:00:00.000Z',
      endsAt: '2026-08-15T03:00:00.000Z',
      onlyMine: false,
      includeCancelled: false,
    };

    await useCase.execute(principal('USUARIO'), query);

    expect(repository.listSchedule).toHaveBeenCalledWith(query, userId, {
      canCancelOwn: true,
      canManageBlocks: false,
      canManageReservations: false,
      canReserve: true,
      canViewPrivateReservations: false,
    });
  });

  it('grants management capabilities to a technician only in their laboratory', async () => {
    const useCase = new ListScheduleUseCase(repository, permissions);
    const query = {
      laboratoryId,
      startsAt: '2026-08-14T03:00:00.000Z',
      endsAt: '2026-08-15T03:00:00.000Z',
      onlyMine: false,
      includeCancelled: false,
    };

    await useCase.execute(principal('TECNICO'), query);

    expect(repository.listSchedule).toHaveBeenCalledWith(
      query,
      userId,
      expect.objectContaining({
        canManageBlocks: true,
        canManageReservations: true,
        canViewPrivateReservations: true,
      }),
    );
  });

  it('passes the authorized laboratory scope into reservation cancellation', async () => {
    const useCase = new CancelReservationUseCase(repository, permissions);
    vi.mocked(repository.cancelReservation).mockResolvedValue({
      ...metadata,
      id: reservationId,
      laboratoryId,
      equipmentId: '66666666-6666-4666-a666-666666666666',
      userId,
      projectId: '77777777-7777-4777-a777-777777777777',
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T11:00:00.000Z',
      status: 'CANCELLED',
      purpose: 'Análise instrumental',
      sampleCount: null,
      notes: null,
      cancelledAt: '2026-08-14T10:00:00.000Z',
      cancelledByUserId: userId,
      cancellationReason: 'Mudança de planejamento',
    });

    await useCase.execute(
      principal('USUARIO'),
      laboratoryId,
      reservationId,
      'Mudança de planejamento',
      { origin: 'api:test', requestId: null },
    );

    expect(repository.cancelReservation).toHaveBeenCalledWith(
      laboratoryId,
      reservationId,
      'Mudança de planejamento',
      { actorId: userId, origin: 'api:test', requestId: null },
      false,
    );
  });

  it('denies schedule access when the membership has no equipment permission', () => {
    const useCase = new ListScheduleUseCase(repository, permissions);

    expect(() =>
      useCase.execute(principal('RESPONSAVEL_CONTROLADOS'), {
        laboratoryId,
        startsAt: '2026-08-14T03:00:00.000Z',
        endsAt: '2026-08-15T03:00:00.000Z',
        onlyMine: false,
        includeCancelled: false,
      }),
    ).toThrow();
    expect(repository.listSchedule).not.toHaveBeenCalled();
  });

  it('rejects reservations in the past using an injectable clock', () => {
    const useCase = new CreateReservationUseCase(
      repository,
      permissions,
      () => new Date('2026-08-14T12:00:00.000Z'),
    );

    expect(() =>
      useCase.execute(
        principal('USUARIO'),
        {
          laboratoryId,
          equipmentId: '66666666-6666-4666-a666-666666666666',
          projectId: '77777777-7777-4777-a777-777777777777',
          startsAt: '2026-08-14T11:00:00.000Z',
          endsAt: '2026-08-14T12:00:00.000Z',
          purpose: 'Reserva no passado',
        },
        { origin: 'api:test', requestId: null },
      ),
    ).toThrow(SchedulingStartsInPastError);
    expect(repository.createReservation).not.toHaveBeenCalled();
  });
});
