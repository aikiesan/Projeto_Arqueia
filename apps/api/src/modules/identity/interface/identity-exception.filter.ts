import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { AuthorizationDeniedError } from '../domain/errors/authorization-denied.error.js';
import { IdentityConflictError } from '../domain/errors/identity-conflict.error.js';
import { IdentityEntityNotFoundError } from '../domain/errors/identity-entity-not-found.error.js';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';

@Catch(AuthorizationDeniedError, IdentityConflictError, IdentityEntityNotFoundError, InvalidCredentialsError)
export class IdentityExceptionFilter implements ExceptionFilter {
  public catch(
    exception:
      | AuthorizationDeniedError
      | IdentityConflictError
      | IdentityEntityNotFoundError
      | InvalidCredentialsError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof InvalidCredentialsError) {
      response.status(HttpStatus.UNAUTHORIZED).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Não foi possível confirmar a credencial informada.',
      });
      return;
    }

    if (exception instanceof AuthorizationDeniedError) {
      response.status(HttpStatus.FORBIDDEN).json({
        code: 'AUTHORIZATION_DENIED',
        message: exception.message,
      });
      return;
    }

    if (exception instanceof IdentityEntityNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: 'IDENTITY_ENTITY_NOT_FOUND',
        message: exception.message,
      });
      return;
    }

    response.status(HttpStatus.CONFLICT).json({
      code: 'IDENTITY_CONFLICT',
      message: exception.message,
    });
  }
}
