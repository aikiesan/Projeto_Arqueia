import {
  cancelReservationInputSchema,
  cancelTechnicalBlockInputSchema,
  createReservationInputSchema,
  createTechnicalBlockInputSchema,
  listScheduleQuerySchema,
  reservationParamsSchema,
  technicalBlockParamsSchema,
  type AuthenticatedPrincipal,
  type CreateReservationInput,
  type CreateReservationResult,
  type CreateTechnicalBlockInput,
  type Reservation,
  type ScheduleResponse,
  type TechnicalBlock,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { CancelReservationUseCase } from '../application/cancel-reservation.use-case.js';
import { CancelTechnicalBlockUseCase } from '../application/cancel-technical-block.use-case.js';
import { CreateReservationUseCase } from '../application/create-reservation.use-case.js';
import { CreateTechnicalBlockUseCase } from '../application/create-technical-block.use-case.js';
import { ListScheduleUseCase } from '../application/list-schedule.use-case.js';
import { SchedulingExceptionFilter } from './scheduling-exception.filter.js';

type ReservationParams = z.output<typeof reservationParamsSchema>;
type TechnicalBlockParams = z.output<typeof technicalBlockParamsSchema>;
const cancelReservationBodySchema = cancelReservationInputSchema.omit({ reservationId: true });
const cancelTechnicalBlockBodySchema = cancelTechnicalBlockInputSchema.omit({
  technicalBlockId: true,
});
type CancelReservationBody = z.output<typeof cancelReservationBodySchema>;
type CancelTechnicalBlockBody = z.output<typeof cancelTechnicalBlockBodySchema>;

function requestContext(requestId?: string): { origin: string; requestId: string | null } {
  return {
    origin: 'api:http',
    requestId: requestId !== undefined && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null,
  };
}

@Controller('api/scheduling')
@UseGuards(JwtAuthGuard)
@UseFilters(SchedulingExceptionFilter)
export class SchedulingController {
  public constructor(
    @Inject(ListScheduleUseCase) private readonly listSchedule: ListScheduleUseCase,
    @Inject(CreateReservationUseCase) private readonly createReservation: CreateReservationUseCase,
    @Inject(CancelReservationUseCase) private readonly cancelReservation: CancelReservationUseCase,
    @Inject(CreateTechnicalBlockUseCase)
    private readonly createTechnicalBlock: CreateTechnicalBlockUseCase,
    @Inject(CancelTechnicalBlockUseCase)
    private readonly cancelTechnicalBlock: CancelTechnicalBlockUseCase,
  ) {}

  @Get()
  public getSchedule(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(listScheduleQuerySchema))
    query: z.output<typeof listScheduleQuerySchema>,
  ): Promise<ScheduleResponse> {
    return this.listSchedule.execute(principal, query);
  }

  @Post('reservations')
  public reserve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createReservationInputSchema)) input: CreateReservationInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<CreateReservationResult> {
    return this.createReservation.execute(principal, input, requestContext(requestId));
  }


  @Post('reservations/:reservationId/cancel')
  public cancelRes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(reservationParamsSchema)) params: ReservationParams,
    @Body(new ZodValidationPipe(cancelReservationBodySchema)) input: CancelReservationBody,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Reservation> {
    return this.cancelReservation.execute(
      principal,
      input.laboratoryId,
      params.reservationId,
      input.reason,
      requestContext(requestId),
    );
  }

  @Post('blocks')
  public block(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createTechnicalBlockInputSchema)) input: CreateTechnicalBlockInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<TechnicalBlock> {
    return this.createTechnicalBlock.execute(principal, input, requestContext(requestId));
  }

  @Post('blocks/:technicalBlockId/cancel')
  public cancelBlock(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(technicalBlockParamsSchema)) params: TechnicalBlockParams,
    @Body(new ZodValidationPipe(cancelTechnicalBlockBodySchema)) input: CancelTechnicalBlockBody,
    @Headers('x-request-id') requestId?: string,
  ): Promise<TechnicalBlock> {
    return this.cancelTechnicalBlock.execute(
      principal,
      input.laboratoryId,
      params.technicalBlockId,
      input.reason,
      requestContext(requestId),
    );
  }
}
