import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  EquipmentCheckInRefusedError,
  EquipmentTrainingRequiredError,
  EquipmentUnavailableError,
  InvalidReservationProjectError,
  ReservationCancellationNoticeError,
  ReservationCheckInError,
  ReservationCompletionError,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationApprovalRequiredError,
  ScheduleResultLimitExceededError,
  SchedulingEquipmentNotFoundError,
  SchedulingStartsInPastError,
  TechnicalBlockNotFoundError,
} from '../domain/scheduling.errors.js';

@Catch(
  AuthorizationDeniedError,
  EquipmentCheckInRefusedError,
  ReservationCheckInError,
  ReservationCompletionError,
  ReservationConflictError,
  ReservationNotFoundError,
  SchedulingEquipmentNotFoundError,
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

    if (exception instanceof AuthorizationDeniedError) {
      response.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: exception.message,
        code: 'AUTHORIZATION_DENIED',
      });
      return;
    }

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

    if (exception instanceof SchedulingEquipmentNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: exception.code,
        message: exception.message,
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

    // 422 e nunca 409: o proxy BFF intercepta todo 409 e o valida contra
    // conflictErrorResponseSchema, virando 502 para qualquer outro formato.
    if (exception instanceof EquipmentCheckInRefusedError) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        code: exception.code,
        message: exception.message,
        nextReservationStartsAt: exception.nextReservationStartsAt,
        occupiedUntil: exception.occupiedUntil,
      });
      return;
    }

    // Antes caíam no 500 genérico por não constarem do @Catch.
    if (
      exception instanceof ReservationCheckInError ||
      exception instanceof ReservationCompletionError
    ) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        code: exception.code,
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
