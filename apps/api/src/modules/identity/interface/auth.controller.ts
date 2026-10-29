import {
  changePasswordInputSchema,
  completePasswordResetInputSchema,
  localLoginInputSchema,
  requestPasswordResetInputSchema,
  type AuthenticatedPrincipal,
  type ChangePasswordInput,
  type CompletePasswordResetInput,
  type LocalLoginInput,
  type LoginResponse,
  type RequestPasswordResetInput,
  type RequestPasswordResetResponse,
} from '@arqueia/contracts';
import {
  BadRequestException,
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
import { ChangePasswordUseCase } from '../application/change-password.use-case.js';
import { CompletePasswordResetUseCase } from '../application/complete-password-reset.use-case.js';
import { LoginLocalUseCase } from '../application/login-local.use-case.js';
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case.js';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error.js';
import { InvalidPasswordResetTokenError } from '../domain/errors/invalid-password-reset-token.error.js';
import { OIDC_PROVIDER, type OidcProvider } from '../domain/ports/oidc-provider.port.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { identityRequestContext } from './identity-request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const requestIdSchema = z.string().uuid();

@Controller('api/auth')
export class AuthController {
  public constructor(
    @Inject(LoginLocalUseCase) private readonly loginLocal: LoginLocalUseCase,
    @Inject(ChangePasswordUseCase) private readonly changePasswordUseCase: ChangePasswordUseCase,
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    @Inject(CompletePasswordResetUseCase)
    private readonly completePasswordResetUseCase: CompletePasswordResetUseCase,
    @Inject(OIDC_PROVIDER) private readonly oidcProvider: OidcProvider,
  ) {}

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
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

  @Post('change-password')
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  public async changePassword(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(changePasswordInputSchema)) input: ChangePasswordInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<{ success: true }> {
    try {
      return await this.changePasswordUseCase.execute(
        principal,
        input,
        identityRequestContext(requestId),
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Credencial atual inválida.',
        });
      }
      throw error;
    }
  }

  /**
   * Público e sem sessão: quem esqueceu a senha não consegue autenticar. A
   * proteção é o limitador por IP, igual ao do login.
   */
  @Post('password-reset/request')
  @UseGuards(AuthRateLimitGuard)
  public async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetInputSchema)) input: RequestPasswordResetInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<RequestPasswordResetResponse> {
    return this.requestPasswordResetUseCase.execute(input, identityRequestContext(requestId));
  }

  @Post('password-reset/complete')
  @UseGuards(AuthRateLimitGuard)
  public async completePasswordReset(
    @Body(new ZodValidationPipe(completePasswordResetInputSchema)) input: CompletePasswordResetInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<{ success: true }> {
    try {
      return await this.completePasswordResetUseCase.execute(
        input,
        identityRequestContext(requestId),
      );
    } catch (error) {
      if (error instanceof InvalidPasswordResetTokenError) {
        throw new BadRequestException({
          code: 'INVALID_PASSWORD_RESET_TOKEN',
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
