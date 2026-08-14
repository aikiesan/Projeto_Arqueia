import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import {
  EquipmentUnavailableError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  ReservationNotFoundError,
  TechnicalBlockNotFoundError,
} from '../domain/scheduling.errors.js';

@Catch(
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationCancellationNoticeError,
  TechnicalBlockNotFoundError,
  EquipmentUnavailableError,
)
export class SchedulingExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ReservationConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        code: exception.code,
        message: exception.message,
        conflictingSlot: {
          startsAt: exception.startsAt ?? null,
          endsAt: exception.endsAt ?? null,
          type: exception.slotType,
        },
      });
      return;
    }

    if (
      exception instanceof ReservationNotFoundError ||
      exception instanceof TechnicalBlockNotFoundError
    ) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: 'NOT_FOUND',
        message: exception.message,
      });
      return;
    }

    if (
      exception instanceof ReservationCancellationNoticeError ||
      exception instanceof EquipmentUnavailableError
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        code: 'BAD_REQUEST',
        message: exception.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: exception.message,
    });
  }
}
