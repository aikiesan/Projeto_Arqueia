import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import {
  BatchNotFoundError,
  InsufficientStockError,
  ProductConflictError,
  ProductNotFoundError,
} from '../domain/inventory.errors.js';
import { InventoryExceptionFilter } from './inventory-exception.filter.js';

describe('InventoryExceptionFilter', () => {
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

    new InventoryExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: error.message,
      code: 'AUTHORIZATION_DENIED',
    });
  });

  it('maps InsufficientStockError to 400 Bad Request with requested vs current balance', () => {
    const { host, status, json } = createHost();
    const error = new InsufficientStockError(10, 3);

    new InventoryExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'INSUFFICIENT_STOCK',
      message: error.message,
      requestedQuantity: 10,
      currentBalance: 3,
    });
  });

  it('maps ProductConflictError to 409 Conflict', () => {
    const { host, status, json } = createHost();
    const error = new ProductConflictError();

    new InventoryExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'PRODUCT_CONFLICT',
      message: error.message,
    });
  });

  it('maps ProductNotFoundError and BatchNotFoundError to 404 Not Found', () => {
    const { host: h1, status: s1, json: j1 } = createHost();
    new InventoryExceptionFilter().catch(new ProductNotFoundError('prod-1'), h1);
    expect(s1).toHaveBeenCalledWith(404);
    expect(j1).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.stringContaining('prod-1'),
    });

    const { host: h2, status: s2, json: j2 } = createHost();
    new InventoryExceptionFilter().catch(new BatchNotFoundError('batch-1'), h2);
    expect(s2).toHaveBeenCalledWith(404);
    expect(j2).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.stringContaining('batch-1'),
    });
  });

  it('maps unhandled errors to 500 Internal Server Error without leaking internal details', () => {
    const { host, status, json } = createHost();
    new InventoryExceptionFilter().catch(new Error('Database disk corrupted'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Erro interno ao processar operação de estoque.',
    });
  });
});
