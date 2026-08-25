import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  AuditEventNotFoundError,
  InvalidPeriodError,
  ManagementLaboratoryNotFoundError,
} from '../domain/management.errors.js';
import { ManagementExceptionFilter } from './management-exception.filter.js';

describe('ManagementExceptionFilter', () => {
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

    new ManagementExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: error.message,
      code: 'AUTHORIZATION_DENIED',
    });
  });

  it('maps AuditEventNotFoundError and ManagementLaboratoryNotFoundError to 404 Not Found', () => {
    const { host: h1, status: s1, json: j1 } = createHost();
    new ManagementExceptionFilter().catch(new AuditEventNotFoundError('evt-1'), h1);
    expect(s1).toHaveBeenCalledWith(404);
    expect(j1).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.stringContaining('evt-1'),
    });

    const { host: h2, status: s2, json: j2 } = createHost();
    new ManagementExceptionFilter().catch(new ManagementLaboratoryNotFoundError('lab-1'), h2);
    expect(s2).toHaveBeenCalledWith(404);
    expect(j2).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.stringContaining('lab-1'),
    });
  });

  it('maps InvalidPeriodError to 400 Bad Request', () => {
    const { host, status, json } = createHost();
    const error = new InvalidPeriodError('A data inicial deve ser anterior à data final.');
    new ManagementExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'INVALID_PERIOD',
      message: 'A data inicial deve ser anterior à data final.',
    });
  });

  it('maps unhandled errors to 500 Internal Server Error without leaking internal details', () => {
    const { host, status, json } = createHost();
    new ManagementExceptionFilter().catch(new Error('Postgres connection pool exhausted'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Erro interno ao processar dados de gestão.',
    });
  });
});
