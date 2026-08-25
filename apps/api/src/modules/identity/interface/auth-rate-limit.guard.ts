import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthRateLimiterService } from '../infrastructure/auth-rate-limiter.service.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  public constructor(
    @Inject(AuthRateLimiterService) private readonly rateLimiter: AuthRateLimiterService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    const path = request.path || 'auth';
    const rateLimitKey = `${path}:${ip}`;

    const status = this.rateLimiter.consume(rateLimitKey);

    if (!status.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((status.resetTimeMs - Date.now()) / 1000));
      const response = context.switchToHttp().getResponse();
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('Retry-After', retryAfterSeconds.toString());
      }

      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Muitas tentativas de autenticação. Por favor, aguarde antes de tentar novamente.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
