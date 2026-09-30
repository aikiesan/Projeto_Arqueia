import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  FieldReportEquipmentMismatchError,
  FieldReportLaboratoryNotFoundError,
  FieldReportNotFoundError,
} from '../domain/field-report.errors.js';

@Catch(
  AuthorizationDeniedError,
  FieldReportNotFoundError,
  FieldReportLaboratoryNotFoundError,
  FieldReportEquipmentMismatchError,
)
export class FieldReportExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AuthorizationDeniedError) {
      response.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: exception.message,
        code: 'AUTHORIZATION_DENIED',
      });
      return;
    }
    if (exception instanceof FieldReportNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: 'FIELD_REPORT_NOT_FOUND',
        message: exception.message,
      });
      return;
    }
    if (exception instanceof FieldReportLaboratoryNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: 'LABORATORY_NOT_FOUND',
        message: exception.message,
      });
      return;
    }
    response.status(HttpStatus.BAD_REQUEST).json({
      code: 'FIELD_REPORT_EQUIPMENT_MISMATCH',
      message: exception.message,
    });
  }
}
