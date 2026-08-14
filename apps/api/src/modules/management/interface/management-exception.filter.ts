import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';

import type { Response } from 'express';

import {
  AuditEventNotFoundError,
  InvalidPeriodError,
  ManagementLaboratoryNotFoundError,
} from '../domain/management.errors.js';

@Catch(AuditEventNotFoundError, InvalidPeriodError, ManagementLaboratoryNotFoundError)
export class ManagementExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (
      exception instanceof AuditEventNotFoundError ||
      exception instanceof ManagementLaboratoryNotFoundError
    ) {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: exception.message,
      });
      return;
    }

    if (exception instanceof InvalidPeriodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_PERIOD',
        message: exception.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno ao processar dados de gestão.',
    });
  }
}
