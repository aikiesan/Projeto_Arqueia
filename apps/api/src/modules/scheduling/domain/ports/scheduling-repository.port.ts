import type {
  CreateReservationInput,
  CreateReservationResult,
  CreateTechnicalBlockInput,
  ListScheduleQuery,
  Reservation,
  ScheduleResponse,
  TechnicalBlock,
} from '@arqueia/contracts';

export interface SchedulingMutationContext {
  actorId: string;
  origin: string;
  requestId: string | null;
}

export interface SchedulingRepository {
  createReservation(
    input: CreateReservationInput,
    context: SchedulingMutationContext,
  ): Promise<CreateReservationResult>;


  cancelReservation(
    reservationId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
    isStaffOrAdmin: boolean,
  ): Promise<Reservation>;

  createTechnicalBlock(
    input: CreateTechnicalBlockInput,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock>;

  cancelTechnicalBlock(
    technicalBlockId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock>;

  listSchedule(
    query: ListScheduleQuery,
    requestingUserId: string,
    isStaffOrAdmin: boolean,
  ): Promise<ScheduleResponse>;
}

export const SCHEDULING_REPOSITORY = Symbol('SCHEDULING_REPOSITORY');
