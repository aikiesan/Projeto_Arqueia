import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { checkInRefusalResponseSchema } from '@arqueia/contracts';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  EquipmentCheckInRefusedError,
  EquipmentTrainingRequiredError,
  EquipmentUnavailableError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  ReservationCheckInError,
  ReservationNotFoundError,
  SchedulingEquipmentNotFoundError,
  TechnicalBlockNotFoundError,
} from '../domain/scheduling.errors.js';
import { SchedulingExceptionFilter } from './scheduling-exception.filter.js';

describe('SchedulingExceptionFilter', () => {
  function createHost(): { host: ArgumentsHost; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('maps AuthorizationDeniedError to 403 Forbidden', () => {
    const { host, status, json } = createHost();
    const error = new AuthorizationDeniedError();

    new SchedulingExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: error.message,
      code: 'AUTHORIZATION_DENIED',
    });
  });

  it('maps ReservationConflictError to 409 Conflict with slot details', () => {
    const { host, status, json } = createHost();
    const error = new ReservationConflictError(
      '2026-08-25T10:00:00.000Z',
      '2026-08-25T12:00:00.000Z',
    );

    new SchedulingExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      code: 'RESERVATION_SLOT_CONFLICT',
      message: error.message,
      requestedSlot: {
        startsAt: '2026-08-25T10:00:00.000Z',
        endsAt: '2026-08-25T12:00:00.000Z',
      },
    });
  });

  it('maps ReservationNotFoundError and TechnicalBlockNotFoundError to 404 Not Found', () => {
    const { host: h1, status: s1, json: j1 } = createHost();
    new SchedulingExceptionFilter().catch(new ReservationNotFoundError('res-1'), h1);
    expect(s1).toHaveBeenCalledWith(404);
    expect(j1).toHaveBeenCalledWith({
      code: 'NOT_FOUND',
      message: expect.stringContaining('res-1'),
    });

    const { host: h2, status: s2, json: j2 } = createHost();
    new SchedulingExceptionFilter().catch(new TechnicalBlockNotFoundError('blk-1'), h2);
    expect(s2).toHaveBeenCalledWith(404);
    expect(j2).toHaveBeenCalledWith({
      code: 'NOT_FOUND',
      message: expect.stringContaining('blk-1'),
    });
  });

  it('maps domain validation errors (training, availability, notice) to 400 Bad Request', () => {
    const { host: h1, status: s1, json: j1 } = createHost();
    new SchedulingExceptionFilter().catch(new EquipmentTrainingRequiredError(), h1);
    expect(s1).toHaveBeenCalledWith(400);
    expect(j1).toHaveBeenCalledWith({
      code: 'EQUIPMENT_TRAINING_REQUIRED',
      message: 'Este equipamento exige habilitação de treinamento ainda não registrada no Arqueia.',
    });

    const { host: h2, status: s2, json: j2 } = createHost();
    new SchedulingExceptionFilter().catch(new EquipmentUnavailableError('MAINTENANCE'), h2);
    expect(s2).toHaveBeenCalledWith(400);
    expect(j2).toHaveBeenCalledWith({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('MAINTENANCE'),
    });

    const { host: h3, status: s3, json: j3 } = createHost();
    new SchedulingExceptionFilter().catch(new ReservationCancellationNoticeError(), h3);
    expect(s3).toHaveBeenCalledWith(400);
    expect(j3).toHaveBeenCalledWith({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('antecedência'),
    });
  });

  describe('check-in pela etiqueta do equipamento', () => {
    it('devolve 422 com um corpo que o contrato de recusa aceita', () => {
      const { host, status, json } = createHost();
      const error = new EquipmentCheckInRefusedError(
        'RESERVATION_NOT_STARTED_YET',
        'Sua reserva ainda não começou.',
        '2026-08-25T10:00:00.000Z',
        null,
      );

      new SchedulingExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(422);
      const body = json.mock.calls[0]?.[0] as unknown;
      expect(checkInRefusalResponseSchema.safeParse(body).success).toBe(true);
      expect(body).toEqual({
        code: 'RESERVATION_NOT_STARTED_YET',
        message: 'Sua reserva ainda não começou.',
        nextReservationStartsAt: '2026-08-25T10:00:00.000Z',
        occupiedUntil: null,
      });
    });

    /**
     * Regressão: o proxy BFF intercepta todo 409 e o valida contra
     * conflictErrorResponseSchema — uma recusa devolvida como 409 viraria 502.
     */
    it('nunca usa 409 para recusa de check-in', () => {
      const { host, status } = createHost();

      new SchedulingExceptionFilter().catch(
        new EquipmentCheckInRefusedError('NO_ACTIVE_RESERVATION', 'Sem reserva ativa.'),
        host,
      );

      expect(status).not.toHaveBeenCalledWith(409);
    });

    it('devolve 404 quando o equipamento não existe no laboratório', () => {
      const { host, status, json } = createHost();
      const error = new SchedulingEquipmentNotFoundError('88888888-8888-4888-a888-888888888888');

      new SchedulingExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        code: 'EQUIPMENT_NOT_FOUND',
        message: error.message,
      });
    });

    /** Antes esta classe não constava do @Catch e caía no 500 genérico. */
    it('devolve 422 para ReservationCheckInError em vez de 500', () => {
      const { host, status, json } = createHost();
      const error = new ReservationCheckInError('Não é possível iniciar reserva com status COMPLETED.');

      new SchedulingExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(422);
      expect(json).toHaveBeenCalledWith({
        code: 'RESERVATION_CHECK_IN_INVALID',
        message: error.message,
      });
    });
  });
});
