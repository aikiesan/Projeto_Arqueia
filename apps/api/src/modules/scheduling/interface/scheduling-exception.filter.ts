import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import {
  EquipmentTrainingRequiredError,
  EquipmentUnavailableError,
  InvalidReservationProjectError,
  ReservationCancellationNoticeError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationApprovalRequiredError,
  ScheduleResultLimitExceededError,
  SchedulingStartsInPastError,
  TechnicalBlockNotFoundError,
} from '../domain/scheduling.errors.js';

@Catch(
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationCancellationNoticeError,
  TechnicalBlockNotFoundError,
  EquipmentUnavailableError,
  EquipmentTrainingRequiredError,
  InvalidReservationProjectError,
  ReservationApprovalRequiredError,
  ScheduleResultLimitExceededError,
  SchedulingStartsInPastError,
)
export class SchedulingExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ReservationConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        code: exception.code,
        message: exception.message,
        requestedSlot: {
          startsAt: exception.startsAt,
          endsAt: exception.endsAt,
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
      exception instanceof EquipmentUnavailableError ||
      exception instanceof EquipmentTrainingRequiredError ||
      exception instanceof ReservationApprovalRequiredError ||
      exception instanceof InvalidReservationProjectError ||
      exception instanceof ScheduleResultLimitExceededError ||
      exception instanceof SchedulingStartsInPastError
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        code: 'code' in exception ? exception.code : 'BAD_REQUEST',
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
