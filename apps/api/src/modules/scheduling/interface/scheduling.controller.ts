import {
  cancelReservationInputSchema,
  cancelTechnicalBlockInputSchema,
  checkInByEquipmentInputSchema,
  checkInReservationInputSchema,
  completeReservationInputSchema,
  createReservationInputSchema,
  createTechnicalBlockInputSchema,
  equipmentParamsSchema,
  listScheduleQuerySchema,
  releaseAbsentReservationsInputSchema,
  reservationParamsSchema,
  startWalkInReservationInputSchema,
  technicalBlockParamsSchema,
  type AuthenticatedPrincipal,
  type CreateReservationInput,
  type CreateReservationResult,
  type CreateTechnicalBlockInput,
  type ReleaseAbsentReservationsInput,
  type ReleaseAbsentReservationsResult,
  type Reservation,
  type ScheduleResponse,
  type StartWalkInReservationInput,
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
import { CheckInReservationByEquipmentUseCase } from '../application/check-in-reservation-by-equipment.use-case.js';
import { CheckInReservationUseCase } from '../application/check-in-reservation.use-case.js';
import { CompleteReservationUseCase } from '../application/complete-reservation.use-case.js';
import { CreateReservationUseCase } from '../application/create-reservation.use-case.js';
import { CreateTechnicalBlockUseCase } from '../application/create-technical-block.use-case.js';
import { ListScheduleUseCase } from '../application/list-schedule.use-case.js';
import { ReleaseAbsentReservationsUseCase } from '../application/release-absent-reservations.use-case.js';
import { StartWalkInReservationUseCase } from '../application/start-walk-in-reservation.use-case.js';
import { SchedulingExceptionFilter } from './scheduling-exception.filter.js';

type ReservationParams = z.output<typeof reservationParamsSchema>;
type TechnicalBlockParams = z.output<typeof technicalBlockParamsSchema>;
type EquipmentCheckInParams = z.output<typeof equipmentParamsSchema>;
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
    @Inject(StartWalkInReservationUseCase)
    private readonly startWalkInReservation: StartWalkInReservationUseCase,
    @Inject(CheckInReservationUseCase) private readonly checkInReservation: CheckInReservationUseCase,
    @Inject(CompleteReservationUseCase)
    private readonly completeReservation: CompleteReservationUseCase,
    @Inject(ReleaseAbsentReservationsUseCase)
    private readonly releaseAbsentReservations: ReleaseAbsentReservationsUseCase,
    @Inject(CancelReservationUseCase) private readonly cancelReservation: CancelReservationUseCase,
    @Inject(CreateTechnicalBlockUseCase)
    private readonly createTechnicalBlock: CreateTechnicalBlockUseCase,
    @Inject(CancelTechnicalBlockUseCase)
    private readonly cancelTechnicalBlock: CancelTechnicalBlockUseCase,
    @Inject(CheckInReservationByEquipmentUseCase)
    private readonly checkInReservationByEquipment: CheckInReservationByEquipmentUseCase,
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

  @Post('reservations/walk-in')
  public walkIn(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(startWalkInReservationInputSchema)) input: StartWalkInReservationInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Reservation> {
    return this.startWalkInReservation.execute(principal, input, requestContext(requestId));
  }

  @Post('reservations/:reservationId/check-in')
  public checkIn(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(reservationParamsSchema)) params: ReservationParams,
    @Body(new ZodValidationPipe(checkInReservationInputSchema.omit({ reservationId: true })))
    body: { laboratoryId: string },
    @Headers('x-request-id') requestId?: string,
  ): Promise<Reservation> {
    return this.checkInReservation.execute(
      principal,
      { laboratoryId: body.laboratoryId, reservationId: params.reservationId },
      requestContext(requestId),
    );
  }

  /**
   * Check-in pela leitura do QR físico do equipamento.
   *
   * O reservationId não vem do cliente: o repositório re-resolve a reserva ativa
   * do ator sob FOR UPDATE, na mesma transação da transição de status.
   */
  @Post('equipment/:equipmentId/check-in')
  public checkInByEquipment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(equipmentParamsSchema)) params: EquipmentCheckInParams,
    @Body(new ZodValidationPipe(checkInByEquipmentInputSchema.omit({ equipmentId: true })))
    body: { laboratoryId: string },
    @Headers('x-request-id') requestId?: string,
  ): Promise<Reservation> {
    return this.checkInReservationByEquipment.execute(
      principal,
      { equipmentId: params.equipmentId, laboratoryId: body.laboratoryId },
      requestContext(requestId),
    );
  }

  @Post('reservations/:reservationId/complete')
  public complete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(reservationParamsSchema)) params: ReservationParams,
    @Body(new ZodValidationPipe(completeReservationInputSchema.omit({ reservationId: true })))
    body: { laboratoryId: string; notes?: string },
    @Headers('x-request-id') requestId?: string,
  ): Promise<Reservation> {
    return this.completeReservation.execute(
      principal,
      { laboratoryId: body.laboratoryId, reservationId: params.reservationId, notes: body.notes },
      requestContext(requestId),
    );
  }

  @Post('reservations/release-absent')
  public releaseAbsent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(releaseAbsentReservationsInputSchema))
    body: ReleaseAbsentReservationsInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<ReleaseAbsentReservationsResult> {
    return this.releaseAbsentReservations.execute(principal, body, requestContext(requestId));
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
