import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { AuthRateLimiterService } from '../../identity/infrastructure/auth-rate-limiter.service.js';

/**
 * Teto de envios por origem no formulário público de informes.
 *
 * Generoso para um laboratório inteiro atrás do mesmo NAT do campus, apertado
 * para um script. Vive só em memória: o IP não é gravado no banco (ADR-009 §10).
 */
export const FIELD_REPORT_RATE_LIMIT = { maxAttempts: 10, windowSeconds: 15 * 60 } as const;
export const FIELD_REPORT_RATE_LIMITER = Symbol('FIELD_REPORT_RATE_LIMITER');

@Injectable()
export class FieldReportRateLimitGuard implements CanActivate {
  public constructor(
    @Inject(FIELD_REPORT_RATE_LIMITER) private readonly rateLimiter: AuthRateLimiterService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // `trust proxy` = 1 (main.ts): request.ip é o endereço que o BFF repassou.
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const status = this.rateLimiter.consume(`field-report:${ip}`);
    if (status.allowed) return true;

    const retryAfterSeconds = Math.max(1, Math.ceil((status.resetTimeMs - Date.now()) / 1000));
    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException(
      {
        code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED',
        message: 'Muitos informes em pouco tempo. Aguarde alguns minutos e tente de novo.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
