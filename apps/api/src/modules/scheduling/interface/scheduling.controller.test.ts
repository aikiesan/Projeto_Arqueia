import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import { ReservationConflictError } from '../domain/scheduling.errors.js';
import type { CancelReservationUseCase } from '../application/cancel-reservation.use-case.js';
import type { CancelTechnicalBlockUseCase } from '../application/cancel-technical-block.use-case.js';
import type { CheckInReservationUseCase } from '../application/check-in-reservation.use-case.js';
import type { CompleteReservationUseCase } from '../application/complete-reservation.use-case.js';
import type { CreateReservationUseCase } from '../application/create-reservation.use-case.js';
import type { CreateTechnicalBlockUseCase } from '../application/create-technical-block.use-case.js';
import type { ListScheduleUseCase } from '../application/list-schedule.use-case.js';
import type { ReleaseAbsentReservationsUseCase } from '../application/release-absent-reservations.use-case.js';
import type { StartWalkInReservationUseCase } from '../application/start-walk-in-reservation.use-case.js';
import { SchedulingExceptionFilter } from './scheduling-exception.filter.js';
import { SchedulingController } from './scheduling.controller.js';

describe('SchedulingController Cross-Laboratory RBAC & Concurrency Conflict Integration', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const userId = '33333333-3333-4333-a333-333333333333';
  const equipmentId = '44444444-4444-4444-a444-444444444444';
  const projectId = '55555555-5555-4555-a555-555555555555';

  const principalLabA: AuthenticatedPrincipal = {
    user: {
      id: userId,
      institutionId: 'inst-1',
      name: 'Pesquisador Lab A',
      email: 'pesquisador@lab-a.local',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    },
    memberships: [
      {
        id: 'm-1',
        userId,
        laboratoryId: labAId,
        role: 'USUARIO',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
    systemRoles: [],
  };

  it('rejects cross-laboratory reservation attempts with AuthorizationDeniedError mapped to HTTP 403', async () => {
    const createReservationUseCase = {
      execute: vi.fn().mockImplementation((principal, input) => {
        if (input.laboratoryId !== labAId) {
          throw new AuthorizationDeniedError();
        }
        return Promise.resolve({ reservation: {} });
      }),
    } as unknown as CreateReservationUseCase;

    const controller = new SchedulingController(
      {} as ListScheduleUseCase,
      createReservationUseCase,
      {} as StartWalkInReservationUseCase,
      {} as CheckInReservationUseCase,
      {} as CompleteReservationUseCase,
      {} as ReleaseAbsentReservationsUseCase,
      {} as CancelReservationUseCase,
      {} as CreateTechnicalBlockUseCase,
      {} as CancelTechnicalBlockUseCase,
    );

    let caughtError: unknown = null;
    try {
      await controller.reserve(
        principalLabA,
        {
          laboratoryId: labBId, // Cross-lab target
          equipmentId,
          projectId,
          startsAt: '2026-08-25T14:00:00.000Z',
          endsAt: '2026-08-25T16:00:00.000Z',
          purpose: 'Ensaio em microscopia',
        },
        undefined,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AuthorizationDeniedError);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    new SchedulingExceptionFilter().catch(caughtError as Error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: (caughtError as AuthorizationDeniedError).message,
      code: 'AUTHORIZATION_DENIED',
    });
  });

  it('handles PostgreSQL 23P01 exclusion conflict converted to ReservationConflictError returning HTTP 409', async () => {
    const createReservationUseCase = {
      execute: vi.fn().mockRejectedValue(
        new ReservationConflictError('2026-08-25T14:00:00.000Z', '2026-08-25T16:00:00.000Z'),
      ),
    } as unknown as CreateReservationUseCase;

    const controller = new SchedulingController(
      {} as ListScheduleUseCase,
      createReservationUseCase,
      {} as StartWalkInReservationUseCase,
      {} as CheckInReservationUseCase,
      {} as CompleteReservationUseCase,
      {} as ReleaseAbsentReservationsUseCase,
      {} as CancelReservationUseCase,
      {} as CreateTechnicalBlockUseCase,
      {} as CancelTechnicalBlockUseCase,
    );

    let caughtError: unknown = null;
    try {
      await controller.reserve(
        principalLabA,
        {
          laboratoryId: labAId,
          equipmentId,
          projectId,
          startsAt: '2026-08-25T14:00:00.000Z',
          endsAt: '2026-08-25T16:00:00.000Z',
          purpose: 'Reserva concorrente',
        },
        undefined,
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ReservationConflictError);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    new SchedulingExceptionFilter().catch(caughtError as Error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      code: 'RESERVATION_SLOT_CONFLICT',
      message: (caughtError as ReservationConflictError).message,
      requestedSlot: {
        startsAt: '2026-08-25T14:00:00.000Z',
        endsAt: '2026-08-25T16:00:00.000Z',
      },
    });
  });
});
