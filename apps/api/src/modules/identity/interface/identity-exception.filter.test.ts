import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import { IdentityExceptionFilter } from './identity-exception.filter.js';

describe('IdentityExceptionFilter', () => {
  it('maps failed reauthentication to 401 without exposing internals', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new IdentityExceptionFilter().catch(new InvalidCredentialsError(), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      code: 'INVALID_CREDENTIALS',
      message: 'Não foi possível confirmar a credencial informada.',
    });
  });
});
