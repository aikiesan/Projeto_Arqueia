import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from '../domain/ports/access-token-verifier.port.js';
import { PRINCIPAL_READER, type PrincipalReader } from '../domain/ports/principal-reader.port.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly tokens: AccessTokenVerifier,
    @Inject(PRINCIPAL_READER) private readonly principals: PrincipalReader,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const [scheme, token, extra] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || token === undefined || extra !== undefined) {
      throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    }

    const verified = await this.tokens.verify(token);
    const principal =
      verified === null ? null : await this.principals.findByUserId(verified.subject);

    if (
      principal === null ||
      principal.user.status !== 'ACTIVE' ||
      principal.user.archivedAt !== null
    ) {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }

    (request as AuthenticatedRequest).principal = principal;

    const passwordChangeAllowedPath =
      request.path.endsWith('/api/auth/change-password')
      || request.path.endsWith('/api/auth/me');
    if (principal.user.mustChangePassword && !passwordChangeAllowedPath) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    return true;
  }
}
