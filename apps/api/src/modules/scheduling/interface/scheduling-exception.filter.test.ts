import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  EquipmentTrainingRequiredError,
  EquipmentUnavailableError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  ReservationNotFoundError,
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
});
