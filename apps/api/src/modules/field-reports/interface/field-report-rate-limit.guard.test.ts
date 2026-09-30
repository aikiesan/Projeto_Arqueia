import type { ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthRateLimiterService } from '../../identity/infrastructure/auth-rate-limiter.service.js';
import { FIELD_REPORT_RATE_LIMIT, FieldReportRateLimitGuard } from './field-report-rate-limit.guard.js';

function httpContext(ip: string, setHeader = vi.fn()): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
}

describe('FieldReportRateLimitGuard', () => {
  it('aceita até o teto por origem e responde 429 com Retry-After depois', () => {
    const guard = new FieldReportRateLimitGuard(
      new AuthRateLimiterService(FIELD_REPORT_RATE_LIMIT.maxAttempts, FIELD_REPORT_RATE_LIMIT.windowSeconds),
    );
    for (let attempt = 0; attempt < FIELD_REPORT_RATE_LIMIT.maxAttempts; attempt += 1) {
      expect(guard.canActivate(httpContext('203.0.113.7'))).toBe(true);
    }

    const setHeader = vi.fn();
    let thrown: unknown;
    try {
      guard.canActivate(httpContext('203.0.113.7', setHeader));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED',
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.stringMatching(/^\d+$/));
  });

  it('conta cada origem separadamente', () => {
    const guard = new FieldReportRateLimitGuard(new AuthRateLimiterService(1, 60));

    expect(guard.canActivate(httpContext('203.0.113.7'))).toBe(true);
    expect(guard.canActivate(httpContext('198.51.100.4'))).toBe(true);
    expect(() => guard.canActivate(httpContext('203.0.113.7'))).toThrow(HttpException);
  });
});
