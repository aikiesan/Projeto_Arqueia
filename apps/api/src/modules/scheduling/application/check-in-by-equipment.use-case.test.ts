import { describe, expect, it, beforeEach } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import { CHECK_IN_EARLY_TOLERANCE_MINUTES } from '@arqueia/contracts';

import { InMemorySchedulingRepository } from '../../../../test/in-memory/in-memory-scheduling-repository.js';
import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { CancelReservationUseCase } from './cancel-reservation.use-case.js';
import { CheckInReservationByEquipmentUseCase } from './check-in-reservation-by-equipment.use-case.js';
import { CreateReservationUseCase } from './create-reservation.use-case.js';
import { ReleaseAbsentReservationsUseCase } from './release-absent-reservations.use-case.js';
import {
  EquipmentCheckInRefusedError,
  SchedulingEquipmentNotFoundError,
} from '../domain/scheduling.errors.js';

/**
 * Check-in pela leitura da etiqueta QR do equipamento.
 *
 * Relógio congelado: a elegibilidade é toda função do tempo, e a tolerância de
 * check-in antecipado só é testável com o relógio sob controle.
 */
describe('CheckInReservationByEquipmentUseCase', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const otherLabId = '99999999-9999-4999-a999-999999999999';
  const gcId = '33333333-3333-4333-a333-333333333333';
  const unknownEquipmentId = '88888888-8888-4888-a888-888888888888';
  const projectId = '44444444-4444-4444-a444-444444444444';
  const studentId = '55555555-5555-4555-a555-555555555555';
  const otherStudentId = '66666666-6666-4666-a666-666666666666';
  const approverId = '77777777-7777-4777-a777-777777777777';
  const context = { origin: 'api:test', requestId: null };

  let simulatedTime: Date;
  let repository: InMemorySchedulingRepository;
  let permissions: PermissionEvaluator;

  const clock = (): Date => simulatedTime;
  const at = (iso: string): void => {
    simulatedTime = new Date(iso);
  };

  function principal(
    userId: string,
    role: 'USUARIO' | 'GESTOR_ACESSO_CP2B' | 'TECNICO',
    laboratoryId = labId,
  ): AuthenticatedPrincipal {
    const timestamps = {
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    };
    return {
      user: {
        ...timestamps,
        id: userId,
        institutionId: 'inst-1',
        name: `Aluno ${userId.slice(0, 8)}`,
        email: `${userId.slice(0, 8)}@unicamp.br`,
        supervisorUserId: null,
        status: 'ACTIVE',
        identityProvider: 'LOCAL',
      },
      memberships: [{ ...timestamps, id: `m-${userId}`, userId, laboratoryId, role }],
      systemRoles: [],
    } as unknown as AuthenticatedPrincipal;
  }

  /** Reserva do GC das 10:00 as 12:00, criada com folga para escapar do guard de passado. */
  async function reserveMorning(userId: string): Promise<void> {
    at('2026-08-20T08:00:00.000Z');
    await new CreateReservationUseCase(repository, permissions, clock).execute(
      principal(userId, 'USUARIO'),
      {
        laboratoryId: labId,
        equipmentId: gcId,
        projectId,
        startsAt: '2026-08-20T10:00:00.000Z',
        endsAt: '2026-08-20T12:00:00.000Z',
        purpose: 'Análise de biogás',
      },
      context,
    );
  }

  function checkIn(userId: string, role: 'USUARIO' | 'GESTOR_ACESSO_CP2B' = 'USUARIO') {
    return new CheckInReservationByEquipmentUseCase(repository, permissions).execute(
      principal(userId, role),
      { laboratoryId: labId, equipmentId: gcId },
      context,
    );
  }

  beforeEach(() => {
    simulatedTime = new Date('2026-08-20T08:00:00.000Z');
    repository = new InMemorySchedulingRepository();
    repository.clock = clock;
    permissions = new PermissionEvaluator();
    repository.registerEquipment({
      id: gcId,
      laboratoryId: labId,
      name: 'Cromatógrafo Gasoso Shimadzu GC-2030NS',
      status: 'AVAILABLE',
      maxReservationMinutes: 1440,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    });
  });

  it('inicia a reserva quando lida no horário', async () => {
    await reserveMorning(studentId);
    at('2026-08-20T10:00:00.000Z');

    const result = await checkIn(studentId);

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.startedAt).toBe('2026-08-20T10:00:00.000Z');
  });

  it('aceita check-in dentro da tolerância de antecipação', async () => {
    await reserveMorning(studentId);
    at('2026-08-20T09:46:00.000Z');

    await expect(checkIn(studentId)).resolves.toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('recusa check-in cedo demais, informando o horário de início', async () => {
    await reserveMorning(studentId);
    at('2026-08-20T09:44:00.000Z');

    const error = await checkIn(studentId).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(EquipmentCheckInRefusedError);
    expect(error).toMatchObject({
      code: 'RESERVATION_NOT_STARTED_YET',
      nextReservationStartsAt: '2026-08-20T10:00:00.000Z',
    });
  });

  it('mantém a tolerância de antecipação em 15 minutos', () => {
    expect(CHECK_IN_EARLY_TOLERANCE_MINUTES).toBe(15);
  });

  it('é idempotente: reler a etiqueta não reescreve startedAt', async () => {
    await reserveMorning(studentId);
    at('2026-08-20T10:00:00.000Z');
    const first = await checkIn(studentId);

    at('2026-08-20T10:30:00.000Z');
    const second = await checkIn(studentId);

    expect(second.id).toBe(first.id);
    expect(second.startedAt).toBe(first.startedAt);
  });

  it('recusa quando a reserva do horário é de outra pessoa, sem vazar quem', async () => {
    await reserveMorning(otherStudentId);
    at('2026-08-20T10:30:00.000Z');

    const error = await checkIn(studentId).catch((err: unknown) => err);

    expect(error).toMatchObject({
      code: 'RESERVATION_OF_ANOTHER_USER',
      occupiedUntil: '2026-08-20T12:00:00.000Z',
    });
    expect((error as Error).message).not.toContain(otherStudentId);
  });

  /**
   * Trava a decisão de projeto: como o alvo é implícito (o adesivo na bancada),
   * um aprovador lendo o QR não pode iniciar a reserva de outra pessoa.
   */
  it('não deixa quem tem scheduling.approve fazer check-in na reserva alheia', async () => {
    await reserveMorning(otherStudentId);
    at('2026-08-20T10:30:00.000Z');

    expect(
      permissions.can(principal(approverId, 'GESTOR_ACESSO_CP2B'), 'scheduling.approve', labId),
    ).toBe(true);
    await expect(checkIn(approverId, 'GESTOR_ACESSO_CP2B')).rejects.toMatchObject({
      code: 'RESERVATION_OF_ANOTHER_USER',
    });
  });

  it('recusa quando não há reserva nenhuma no equipamento', async () => {
    at('2026-08-20T10:00:00.000Z');

    await expect(checkIn(studentId)).rejects.toMatchObject({ code: 'NO_ACTIVE_RESERVATION' });
  });

  it('recusa com motivo próprio quando a reserva foi cancelada', async () => {
    await reserveMorning(studentId);
    const reservationId = [...repository.reservations.values()][0]!.id;
    at('2026-08-20T08:30:00.000Z');
    await new CancelReservationUseCase(repository, permissions).execute(
      principal(studentId, 'USUARIO'),
      labId,
      reservationId,
      'Desistência',
      context,
    );

    at('2026-08-20T10:30:00.000Z');
    await expect(checkIn(studentId)).rejects.toMatchObject({ code: 'RESERVATION_CANCELLED' });
  });

  it('recusa com motivo próprio quando a reserva foi liberada por ausência', async () => {
    await reserveMorning(studentId);
    // Tolerância de ausência do equipamento (30 min) já vencida.
    at('2026-08-20T10:45:00.000Z');
    await new ReleaseAbsentReservationsUseCase(repository, permissions).execute(
      principal(approverId, 'TECNICO'),
      { laboratoryId: labId },
      context,
    );

    await expect(checkIn(studentId)).rejects.toMatchObject({
      code: 'RESERVATION_RELEASED_ABSENCE',
    });
  });

  it('não permite check-in antecipado enquanto o usuário anterior não finalizou', async () => {
    await reserveMorning(otherStudentId);
    at('2026-08-20T09:00:00.000Z');
    await new CreateReservationUseCase(repository, permissions, clock).execute(
      principal(studentId, 'USUARIO'),
      {
        laboratoryId: labId,
        equipmentId: gcId,
        projectId,
        startsAt: '2026-08-20T12:00:00.000Z',
        endsAt: '2026-08-20T14:00:00.000Z',
        purpose: 'Análise seguinte',
      },
      context,
    );

    at('2026-08-20T11:00:00.000Z');
    await checkIn(otherStudentId);

    // 11:50 cai na tolerância de 15 min da reserva das 12:00, mas o anterior
    // ainda está com o equipamento na mão.
    at('2026-08-20T11:50:00.000Z');
    await expect(checkIn(studentId)).rejects.toMatchObject({
      code: 'EQUIPMENT_BUSY_WITH_PREVIOUS',
      occupiedUntil: '2026-08-20T12:00:00.000Z',
    });
  });

  it('rejeita equipamento inexistente no laboratório', async () => {
    at('2026-08-20T10:00:00.000Z');

    await expect(
      new CheckInReservationByEquipmentUseCase(repository, permissions).execute(
        principal(studentId, 'USUARIO'),
        { laboratoryId: labId, equipmentId: unknownEquipmentId },
        context,
      ),
    ).rejects.toBeInstanceOf(SchedulingEquipmentNotFoundError);
  });

  it('nega quem não tem scheduling.reserve no laboratório alvo', async () => {
    await reserveMorning(studentId);
    at('2026-08-20T10:00:00.000Z');

    // execute() valida a permissão de forma síncrona, antes de devolver a Promise.
    expect(() =>
      new CheckInReservationByEquipmentUseCase(repository, permissions).execute(
        principal(studentId, 'USUARIO', otherLabId),
        { laboratoryId: labId, equipmentId: gcId },
        context,
      ),
    ).toThrow(AuthorizationDeniedError);
  });
});
