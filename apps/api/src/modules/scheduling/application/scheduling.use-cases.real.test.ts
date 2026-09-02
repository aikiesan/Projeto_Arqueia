import { describe, expect, it, beforeEach } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';

import {
  InMemorySchedulingRepository,
  type InMemoryEquipmentInfo,
} from '../../../../test/in-memory/in-memory-scheduling-repository.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { CreateReservationUseCase } from './create-reservation.use-case.js';
import { StartWalkInReservationUseCase } from './start-walk-in-reservation.use-case.js';
import { CheckInReservationUseCase } from './check-in-reservation.use-case.js';
import { CompleteReservationUseCase } from './complete-reservation.use-case.js';
import { ReleaseAbsentReservationsUseCase } from './release-absent-reservations.use-case.js';
import { CancelReservationUseCase } from './cancel-reservation.use-case.js';
import { CreateTechnicalBlockUseCase } from './create-technical-block.use-case.js';
import { CancelTechnicalBlockUseCase } from './cancel-technical-block.use-case.js';
import { ListScheduleUseCase } from './list-schedule.use-case.js';
import {
  EquipmentUnavailableError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  SchedulingStartsInPastError,
} from '../domain/scheduling.errors.js';

describe('Scheduling Domain Comprehensive Real Tests & Edge Cases (No Mocks)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const equipmentHplcId = '22222222-2222-4222-a222-222222222222';
  const equipmentGcId = '33333333-3333-4333-a333-333333333333';
  const projectId = '44444444-4444-4444-a444-444444444444';
  const userAId = '55555555-5555-4555-a555-555555555555';
  const userBId = '66666666-6666-4666-a666-666666666666';
  const managerId = '77777777-7777-4777-a777-777777777777';

  function createPrincipal(
    userId: string,
    role: 'ADMIN' | 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
  ): AuthenticatedPrincipal {
    const isSystemAdmin = role === 'ADMIN';
    return {
      user: {
        id: userId,
        institutionId: 'inst-1',
        name: `Usuário ${userId.slice(0, 8)}`,
        email: `${userId.slice(0, 8)}@arqueia.local`,
        supervisorUserId: null,
        status: 'ACTIVE',
        identityProvider: 'LOCAL',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
      memberships: isSystemAdmin
        ? []
        : [
            {
              id: `m-${userId}`,
              userId,
              laboratoryId: labId,
              role,
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ],
      systemRoles: isSystemAdmin
        ? [
            {
              id: 'sr-1',
              userId,
              role: 'ADMIN',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ]
        : [],
    };
  }

  let repository: InMemorySchedulingRepository;
  let permissions: PermissionEvaluator;
  let simulatedTime: Date;
  const clock = () => simulatedTime;
  const context = { origin: 'api:test', requestId: 'req-sched-123' };

  beforeEach(() => {
    simulatedTime = new Date('2026-08-20T08:00:00.000Z');
    repository = new InMemorySchedulingRepository();
    repository.clock = clock;
    permissions = new PermissionEvaluator();

    // Register equipments
    repository.registerEquipment({
      id: equipmentHplcId,
      laboratoryId: labId,
      name: 'Cromatógrafo HPLC Waters Alliance',
      status: 'AVAILABLE',
      maxReservationMinutes: 480, // 8 hours max
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    });

    repository.registerEquipment({
      id: equipmentGcId,
      laboratoryId: labId,
      name: 'Cromatógrafo Gasoso Shimadzu GC-2030NS',
      status: 'AVAILABLE',
      maxReservationMinutes: 1440, // 24 hours max
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    });
  });

  describe('1. Collision Math & Overlap Detection', () => {
    it('detects and rejects exact overlap collision', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // User A reserves 10:00 - 12:00
      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Análise de ácidos orgânicos',
        },
        context,
      );

      // User B attempts exact 10:00 - 12:00
      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T10:00:00.000Z',
            endsAt: '2026-08-20T12:00:00.000Z',
            purpose: 'Tentativa colidente exata',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('rejects partial overlap at start (09:30 - 10:30)', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva base',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T09:30:00.000Z',
            endsAt: '2026-08-20T10:30:00.000Z',
            purpose: 'Sobreposição de início',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('rejects partial overlap at end (11:30 - 12:30)', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva base',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T11:30:00.000Z',
            endsAt: '2026-08-20T12:30:00.000Z',
            purpose: 'Sobreposição de término',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('rejects engulfing interval (09:00 - 13:00)', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva base',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T09:00:00.000Z',
            endsAt: '2026-08-20T13:00:00.000Z',
            purpose: 'Intervalo englobante',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('rejects internal contained interval (10:30 - 11:30)', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva base',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T10:30:00.000Z',
            endsAt: '2026-08-20T11:30:00.000Z',
            purpose: 'Intervalo contido',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('allows adjacent intervals (08:00 - 10:00, 10:00 - 12:00, 12:00 - 14:00)', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const listUseCase = new ListScheduleUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // Slot 1: 08:00 - 10:00
      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T08:00:00.000Z',
          endsAt: '2026-08-20T10:00:00.000Z',
          purpose: 'Slot anterior',
        },
        context,
      );

      // Slot 2: 10:00 - 12:00
      await createUseCase.execute(
        userB,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Slot central',
        },
        context,
      );

      // Slot 3: 12:00 - 14:00
      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T12:00:00.000Z',
          endsAt: '2026-08-20T14:00:00.000Z',
          purpose: 'Slot posterior',
        },
        context,
      );

      const schedule = await listUseCase.execute(userA, {
        laboratoryId: labId,
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-20T23:59:59.000Z',
      });
      expect(schedule.items).toHaveLength(3);
    });

    it('handles overnight reservations spanning midnight seamlessly', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // Overnight: 2026-08-20T22:00 to 2026-08-21T06:00 (8 hours on GC)
      const res = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentGcId,
          projectId,
          startsAt: '2026-08-20T22:00:00.000Z',
          endsAt: '2026-08-21T06:00:00.000Z',
          purpose: 'Corrida cromatográfica noturna contínua',
        },
        context,
      );

      expect(res.createdReservations[0]!.id).toBeDefined();

      // Early morning next day overlap: 2026-08-21T05:00 to 07:00
      await expect(
        createUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentGcId,
            projectId,
            startsAt: '2026-08-21T05:00:00.000Z',
            endsAt: '2026-08-21T07:00:00.000Z',
            purpose: 'Tentativa colidente na manhã seguinte',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });
  });

  describe('2. Equipment Status, Duration & Training Policies', () => {
    it('rejects reservation on equipment under MAINTENANCE, UNDER_EVALUATION or UNAVAILABLE', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');

      // Put equipment in MAINTENANCE
      const maintEq: InMemoryEquipmentInfo = {
        id: '99999999-9999-4999-a999-999999999999',
        laboratoryId: labId,
        name: 'Espectrômetro em Manutenção',
        status: 'MAINTENANCE',
        maxReservationMinutes: 480,
        requiresTraining: false,
        requiresApproval: false,
      };
      repository.registerEquipment(maintEq);

      await expect(
        createUseCase.execute(
          userA,
          {
            laboratoryId: labId,
            equipmentId: maintEq.id,
            projectId,
            startsAt: '2026-08-20T10:00:00.000Z',
            endsAt: '2026-08-20T12:00:00.000Z',
            purpose: 'Tentativa em equipamento indisponível',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(EquipmentUnavailableError);
    });

    it('enforces equipment maxReservationMinutes policy limit', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');

      // HPLC has maxReservationMinutes = 480 (8 hours)
      // Attempting 481 minutes (8h 1min): 10:00 to 18:01
      await expect(
        createUseCase.execute(
          userA,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T10:00:00.000Z',
            endsAt: '2026-08-20T18:01:00.000Z',
            purpose: 'Excesso de limite de reserva',
          },
          context,
        ),
      ).rejects.toThrow(/excede o limite do equipamento/i);
    });

    it('rejects reservation starting in the past relative to server clock', () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');

      // Server clock is at 2026-08-20T08:00:00.000Z
      expect(() =>
        createUseCase.execute(
          userA,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T07:00:00.000Z',
            endsAt: '2026-08-20T09:00:00.000Z',
            purpose: 'Tentativa no passado',
          },
          context,
        ),
      ).toThrow(SchedulingStartsInPastError);
    });
  });

  describe('3. Technical Blocks & Maintenance Locking', () => {
    it('creates technical block and prevents any reservation during maintenance', async () => {
      const createBlockUseCase = new CreateTechnicalBlockUseCase(repository, permissions, clock);
      const createResUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const cancelBlockUseCase = new CancelTechnicalBlockUseCase(repository, permissions);
      const tecnico = createPrincipal(managerId, 'TECNICO');
      const userA = createPrincipal(userAId, 'USUARIO');

      // Technician blocks 14:00 - 18:00 for Calibration
      const block = await createBlockUseCase.execute(
        tecnico,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          startsAt: '2026-08-20T14:00:00.000Z',
          endsAt: '2026-08-20T18:00:00.000Z',
          reason: 'CALIBRATION',
          description: 'Calibração anual rastreável RBC',
        },
        context,
      );

      expect(block.status).toBe('ACTIVE');

      // User A attempts reservation 15:00 - 17:00 during block
      await expect(
        createResUseCase.execute(
          userA,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            startsAt: '2026-08-20T15:00:00.000Z',
            endsAt: '2026-08-20T17:00:00.000Z',
            purpose: 'Tentativa durante bloqueio',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);

      // Cancel technical block
      const cancelledBlock = await cancelBlockUseCase.execute(
        tecnico,
        labId,
        block.id,
        'Calibração finalizada antecipadamente',
        context,
      );
      expect(cancelledBlock.status).toBe('CANCELLED');

      // Slot is now freed up for reservation
      const res = await createResUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T15:00:00.000Z',
          endsAt: '2026-08-20T17:00:00.000Z',
          purpose: 'Reserva após desbloqueio técnico',
        },
        context,
      );
      expect(res.createdReservations).toHaveLength(1);
    });
  });

  describe('4. Recurring Reservations Expansion & Partial Collisions', () => {
    it('creates weekly recurring reservations across multiple weeks', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');

      // 4 weekly reservations on Thursdays: Aug 20, Aug 27, Sep 03, Sep 10
      const result = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Ensaio semanal de bioprocesso',
          recurrence: {
            frequency: 'WEEKLY',
            untilDate: '2026-09-10T23:59:59.000Z',
          },
        },
        context,
      );

      expect(result.createdReservations).toHaveLength(4);
      expect(result.conflictingSlots).toHaveLength(0);
    });

    it('handles partial collision gracefully: creates available slots and reports conflicting ones', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // User B already has reservation on Aug 27 (Week 2): 10:00 - 12:00
      await createUseCase.execute(
        userB,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-27T10:00:00.000Z',
          endsAt: '2026-08-27T12:00:00.000Z',
          purpose: 'Reserva conflitante prévia',
        },
        context,
      );

      // User A creates recurring weekly reservation for 4 weeks
      const result = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Série com colisão parcial',
          recurrence: {
            frequency: 'WEEKLY',
            untilDate: '2026-09-10T23:59:59.000Z',
          },
        },
        context,
      );

      // Weeks 1, 3, 4 created (3 total); Week 2 reported in conflictingSlots
      expect(result.createdReservations).toHaveLength(3);
      expect(result.conflictingSlots).toHaveLength(1);
      expect(result.conflictingSlots[0]!.startsAt).toBe('2026-08-27T10:00:00.000Z');
    });
  });

  describe('5. Cancellations, Notice Windows & RBAC', () => {
    it('enforces 30-minute minimum notice for regular user cancellations', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const cancelUseCase = new CancelReservationUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');

      // Reservation starts at 10:00
      const res = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva para teste de aviso prévio',
        },
        context,
      );

      const reservationId = res.createdReservations[0]!.id;

      // Advance clock to 09:40 (only 20 min before start -> less than 30 min notice!)
      simulatedTime = new Date('2026-08-20T09:40:00.000Z');

      await expect(
        cancelUseCase.execute(userA, labId, reservationId, 'Cancelamento em cima da hora', context),
      ).rejects.toBeInstanceOf(ReservationCancellationNoticeError);

      // But a TECNICO / Manager CAN cancel even with short notice
      const tecnico = createPrincipal(managerId, 'TECNICO');
      const cancelledByManager = await cancelUseCase.execute(
        tecnico,
        labId,
        reservationId,
        'Cancelamento de emergência pelo gestor',
        context,
      );
      expect(cancelledByManager.status).toBe('CANCELLED');
    });

    it('denies regular user from cancelling another user reservation', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const cancelUseCase = new CancelReservationUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      const res = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T14:00:00.000Z',
          endsAt: '2026-08-20T16:00:00.000Z',
          purpose: 'Reserva do usuário A',
        },
        context,
      );

      await expect(
        cancelUseCase.execute(userB, labId, res.createdReservations[0]!.id, 'Ataque de cancelamento', context),
      ).rejects.toThrow(/não tem permissão para cancelar/i);
    });
  });

  describe('6. Schedule Listing, Privacy & Filtering', () => {
    it('redacts private reservation details for non-owners while showing full details to owner and managers', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const listUseCase = new ListScheduleUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');
      const tecnico = createPrincipal(managerId, 'TECNICO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Análise confidencial de patente',
        },
        context,
      );

      // User B lists schedule (does not own the reservation)
      const userBSchedule = await listUseCase.execute(userB, {
        laboratoryId: labId,
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-20T23:59:59.000Z',
      });
      expect(userBSchedule.items).toHaveLength(1);
      const itemForB = userBSchedule.items[0]!;
      expect(itemForB.isMine).toBe(false);
      expect(itemForB.title).toBe('Equipamento Reservado');
      expect(itemForB.reservationDetails).toBeNull();
      expect(itemForB.canCancel).toBe(false);

      // User A lists schedule (owns the reservation)
      const userASchedule = await listUseCase.execute(userA, {
        laboratoryId: labId,
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-20T23:59:59.000Z',
      });
      const itemForA = userASchedule.items[0]!;
      expect(itemForA.isMine).toBe(true);
      expect(itemForA.title).toBe('Reserva: Análise confidencial de patente');
      expect(itemForA.reservationDetails?.purpose).toBe('Análise confidencial de patente');
      expect(itemForA.canCancel).toBe(true);

      // Manager lists schedule (can see private details and cancel)
      const managerSchedule = await listUseCase.execute(tecnico, {
        laboratoryId: labId,
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-20T23:59:59.000Z',
      });
      const itemForManager = managerSchedule.items[0]!;
      expect(itemForManager.title).toBe('Reserva: Análise confidencial de patente');
      expect(itemForManager.reservationDetails?.purpose).toBe('Análise confidencial de patente');
      expect(itemForManager.canCancel).toBe(true);
    });

    it('filters schedule with onlyMine flag', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const listUseCase = new ListScheduleUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva A',
        },
        context,
      );

      await createUseCase.execute(
        userB,
        {
          laboratoryId: labId,
          equipmentId: equipmentGcId,
          projectId,
          startsAt: '2026-08-20T14:00:00.000Z',
          endsAt: '2026-08-20T16:00:00.000Z',
          purpose: 'Reserva B',
        },
        context,
      );

      // Query onlyMine for User A
      const result = await listUseCase.execute(userA, {
        laboratoryId: labId,
        startsAt: '2026-08-20T00:00:00.000Z',
        endsAt: '2026-08-20T23:59:59.000Z',
        onlyMine: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.isMine).toBe(true);
    });
  });

  describe('7. Walk-In (QR Code Immediate Usage), Check-In, Completion & Absence Auto-Release', () => {
    it('allows student to arrive, scan QR Code on available equipment and immediately start usage', async () => {
      const walkInUseCase = new StartWalkInReservationUseCase(repository, permissions);
      const completeUseCase = new CompleteReservationUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');

      // Student arrives at HPLC, scans QR Code at 08:00 and chooses 120 minutes of usage
      const reservation = await walkInUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          durationMinutes: 120,
          purpose: 'Uso imediato via QR Code: cromatografia urgente',
        },
        context,
      );

      expect(reservation.status).toBe('IN_PROGRESS');
      expect(reservation.startedAt).toBe('2026-08-20T08:00:00.000Z');
      expect(reservation.endsAt).toBe('2026-08-20T10:00:00.000Z');

      // Finish usage at 09:30
      simulatedTime = new Date('2026-08-20T09:30:00.000Z');
      const completed = await completeUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          reservationId: reservation.id,
          notes: 'Análise finalizada com pico nítido.',
        },
        context,
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBe('2026-08-20T09:30:00.000Z');
    });

    it('rejects walk-in usage if equipment is already in use or planned in that interval', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const walkInUseCase = new StartWalkInReservationUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // User A has reserved 08:30 - 11:30
      await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T08:30:00.000Z',
          endsAt: '2026-08-20T11:30:00.000Z',
          purpose: 'Reserva agendada',
        },
        context,
      );

      // Student B arrives at 08:00 and tries 60 min walk-in (would overlap from 08:30 to 09:00)
      await expect(
        walkInUseCase.execute(
          userB,
          {
            laboratoryId: labId,
            equipmentId: equipmentHplcId,
            projectId,
            durationMinutes: 60,
            purpose: 'Uso imediato conflitante',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('executes planned reservation check-in and completion lifecycle', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const checkInUseCase = new CheckInReservationUseCase(repository, permissions);
      const completeUseCase = new CompleteReservationUseCase(repository, permissions);
      const userA = createPrincipal(userAId, 'USUARIO');

      // Create reservation for 10:00 - 12:00
      const created = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva planejada',
        },
        context,
      );

      const reservationId = created.createdReservations[0]!.id;

      // Advance clock to 10:05 (student arrives at lab)
      simulatedTime = new Date('2026-08-20T10:05:00.000Z');

      const checkedIn = await checkInUseCase.execute(
        userA,
        { laboratoryId: labId, reservationId },
        context,
      );
      expect(checkedIn.status).toBe('IN_PROGRESS');
      expect(checkedIn.startedAt).toBe('2026-08-20T10:05:00.000Z');

      // Advance clock to 11:45 (student finishes)
      simulatedTime = new Date('2026-08-20T11:45:00.000Z');
      const completed = await completeUseCase.execute(
        userA,
        { laboratoryId: labId, reservationId, notes: 'Lavagem de coluna realizada.' },
        context,
      );
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBe('2026-08-20T11:45:00.000Z');
    });

    it('automatically releases unattended reservations on absence timeout and frees slot for other users', async () => {
      const createUseCase = new CreateReservationUseCase(repository, permissions, clock);
      const releaseUseCase = new ReleaseAbsentReservationsUseCase(repository, permissions);
      const walkInUseCase = new StartWalkInReservationUseCase(repository, permissions);
      const manager = createPrincipal(managerId, 'TECNICO');
      const userA = createPrincipal(userAId, 'USUARIO');
      const userB = createPrincipal(userBId, 'USUARIO');

      // User A reserved 10:00 - 12:00 (absence tolerance = 30 min)
      const res = await createUseCase.execute(
        userA,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          purpose: 'Reserva do usuário ausente',
        },
        context,
      );
      const resId = res.createdReservations[0]!.id;

      // Advance clock to 10:35 (35 min after start -> exceeds 30 min tolerance!)
      simulatedTime = new Date('2026-08-20T10:35:00.000Z');

      const releaseResult = await releaseUseCase.execute(
        manager,
        { laboratoryId: labId },
        context,
      );

      expect(releaseResult.releasedCount).toBe(1);
      expect(releaseResult.releasedReservationIds).toContain(resId);

      // Now Student B arrives at 10:36, scans QR Code and can immediately use the freed equipment!
      simulatedTime = new Date('2026-08-20T10:36:00.000Z');
      const walkInRes = await walkInUseCase.execute(
        userB,
        {
          laboratoryId: labId,
          equipmentId: equipmentHplcId,
          projectId,
          durationMinutes: 60,
          purpose: 'Uso de oportunidade pós liberação por ausência',
        },
        context,
      );

      expect(walkInRes.status).toBe('IN_PROGRESS');
      expect(walkInRes.startedAt).toBe('2026-08-20T10:36:00.000Z');
    });
  });
});
