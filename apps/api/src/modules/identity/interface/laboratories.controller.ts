import {
  createLaboratoryInputSchema,
  type AuthenticatedPrincipal,
  type CreateLaboratoryInput,
  type Laboratory,
  laboratoryParamsSchema,
  type UpdateLaboratoryInput,
  updateLaboratoryInputSchema,
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
import { CreateLaboratoryUseCase } from '../application/create-laboratory.use-case.js';
import { ListLaboratoriesUseCase } from '../application/list-laboratories.use-case.js';
import { UpdateLaboratoryUseCase } from '../application/update-laboratory.use-case.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { IdentityExceptionFilter } from './identity-exception.filter.js';
import { identityRequestContext } from './identity-request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type LaboratoryParams = z.output<typeof laboratoryParamsSchema>;

@Controller('api/laboratories')
@UseGuards(JwtAuthGuard)
@UseFilters(IdentityExceptionFilter)
export class LaboratoriesController {
  public constructor(
    @Inject(ListLaboratoriesUseCase)
    private readonly listLaboratories: ListLaboratoriesUseCase,
    @Inject(CreateLaboratoryUseCase)
    private readonly createLaboratory: CreateLaboratoryUseCase,
    @Inject(UpdateLaboratoryUseCase)
    private readonly updateLaboratory: UpdateLaboratoryUseCase,
  ) {}

  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<readonly Laboratory[]> {
    return this.listLaboratories.execute(principal);
  }

  @Post()
  public create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createLaboratoryInputSchema)) input: CreateLaboratoryInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Laboratory> {
    return this.createLaboratory.execute(principal, input, identityRequestContext(requestId));
  }

  @Patch(':laboratoryId')
  public update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(laboratoryParamsSchema)) params: LaboratoryParams,
    @Body(new ZodValidationPipe(updateLaboratoryInputSchema)) input: UpdateLaboratoryInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Laboratory> {
    return this.updateLaboratory.execute(
      principal,
      params.laboratoryId,
      input,
      identityRequestContext(requestId),
    );
  }
}
