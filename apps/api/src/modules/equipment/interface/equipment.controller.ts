import {
  createEquipmentInputSchema,
  equipmentParamsSchema,
  listEquipmentQuerySchema,
  updateEquipmentInputSchema,
  type AuthenticatedPrincipal,
  type CreateEquipmentInput,
  type Equipment,
  type EquipmentPage,
  type EquipmentStatus,
  type UpdateEquipmentInput,
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
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { CreateEquipmentUseCase } from '../application/create-equipment.use-case.js';
import { ListEquipmentUseCase } from '../application/list-equipment.use-case.js';
import { UpdateEquipmentUseCase } from '../application/update-equipment.use-case.js';
import { EquipmentExceptionFilter } from './equipment-exception.filter.js';

type EquipmentParams = z.output<typeof equipmentParamsSchema>;
interface ParsedEquipmentQuery {
  laboratoryId: string;
  status?: EquipmentStatus;
  search?: string;
  cursor?: string;
  limit: number;
}

function requestContext(requestId?: string): { origin: string; requestId: string | null } {
  return {
    origin: 'api:http',
    requestId: requestId !== undefined && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null,
  };
}

@Controller('api/equipment')
@UseGuards(JwtAuthGuard)
@UseFilters(EquipmentExceptionFilter)
export class EquipmentController {
  public constructor(
    @Inject(ListEquipmentUseCase) private readonly listEquipment: ListEquipmentUseCase,
    @Inject(CreateEquipmentUseCase) private readonly createEquipment: CreateEquipmentUseCase,
    @Inject(UpdateEquipmentUseCase) private readonly updateEquipment: UpdateEquipmentUseCase,
  ) {}

  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(listEquipmentQuerySchema)) query: ParsedEquipmentQuery,
  ): Promise<EquipmentPage> {
    return this.listEquipment.execute(principal, query);
  }

  @Post()
  public create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createEquipmentInputSchema)) input: CreateEquipmentInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Equipment> {
    return this.createEquipment.execute(principal, input, requestContext(requestId));
  }

  @Patch(':equipmentId')
  public update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(equipmentParamsSchema)) params: EquipmentParams,
    @Body(new ZodValidationPipe(updateEquipmentInputSchema)) input: UpdateEquipmentInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Equipment> {
    return this.updateEquipment.execute(
      principal,
      params.equipmentId,
      input,
      requestContext(requestId),
    );
  }
}
