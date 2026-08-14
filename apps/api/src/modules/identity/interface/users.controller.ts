import {
  createUserInputSchema,
  type AuthenticatedPrincipal,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
  updateUserInputSchema,
  userParamsSchema,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { CreateUserUseCase } from '../application/create-user.use-case.js';
import { ListUsersUseCase } from '../application/list-users.use-case.js';
import { UpdateUserUseCase } from '../application/update-user.use-case.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { IdentityExceptionFilter } from './identity-exception.filter.js';
import { identityRequestContext } from './identity-request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type UserParams = z.output<typeof userParamsSchema>;

@Controller('api/users')
@UseGuards(JwtAuthGuard)
@UseFilters(IdentityExceptionFilter)
export class UsersController {
  public constructor(
    @Inject(ListUsersUseCase) private readonly listUsers: ListUsersUseCase,
    @Inject(CreateUserUseCase) private readonly createUser: CreateUserUseCase,
    @Inject(UpdateUserUseCase) private readonly updateUser: UpdateUserUseCase,
  ) {}

  @Get()
  public list(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<readonly User[]> {
    return this.listUsers.execute(principal);
  }

  @Post()
  public create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createUserInputSchema)) input: CreateUserInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<User> {
    return this.createUser.execute(principal, input, identityRequestContext(requestId));
  }

  @Patch(':userId')
  public update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(userParamsSchema)) params: UserParams,
    @Body(new ZodValidationPipe(updateUserInputSchema)) input: UpdateUserInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<User> {
    return this.updateUser.execute(
      principal,
      params.userId,
      input,
      identityRequestContext(requestId),
    );
  }
}
