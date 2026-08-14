import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  EquipmentConflictError,
  EquipmentNotFoundError,
  EquipmentReferenceError,
} from '../domain/equipment.errors.js';

@Catch(
  AuthorizationDeniedError,
  EquipmentConflictError,
  EquipmentNotFoundError,
  EquipmentReferenceError,
)
export class EquipmentExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AuthorizationDeniedError) {
      response.status(HttpStatus.FORBIDDEN).json({
        code: 'AUTHORIZATION_DENIED',
        message: exception.message,
      });
      return;
    }
    if (exception instanceof EquipmentNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: 'EQUIPMENT_NOT_FOUND',
        message: exception.message,
      });
      return;
    }
    if (exception instanceof EquipmentReferenceError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        code: 'EQUIPMENT_REFERENCE_INVALID',
        message: exception.message,
      });
      return;
    }
    response.status(HttpStatus.CONFLICT).json({
      code: 'EQUIPMENT_CONFLICT',
      message: exception.message,
    });
  }
}
