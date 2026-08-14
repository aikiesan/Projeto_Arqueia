import {
  localLoginInputSchema,
  type AuthenticatedPrincipal,
  type LocalLoginInput,
  type LoginResponse,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { LoginLocalUseCase } from '../application/login-local.use-case.js';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import { OIDC_PROVIDER, type OidcProvider } from '../domain/ports/oidc-provider.port.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const requestIdSchema = z.string().uuid();

@Controller('api/auth')
export class AuthController {
  public constructor(
    @Inject(LoginLocalUseCase) private readonly loginLocal: LoginLocalUseCase,
    @Inject(OIDC_PROVIDER) private readonly oidcProvider: OidcProvider,
  ) {}

  @Post('login')
  public async login(
    @Body(new ZodValidationPipe(localLoginInputSchema)) input: LocalLoginInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<LoginResponse> {
    try {
      return await this.loginLocal.execute(input, {
        origin: 'api:http',
        requestId: requestIdSchema.safeParse(requestId).data ?? null,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: error.message,
        });
      }

      throw error;
    }
  }

  @Get('oidc')
  public oidcMetadata(): ReturnType<OidcProvider['getMetadata']> {
    return this.oidcProvider.getMetadata();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public me(@CurrentPrincipal() principal: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return principal;
  }
}
