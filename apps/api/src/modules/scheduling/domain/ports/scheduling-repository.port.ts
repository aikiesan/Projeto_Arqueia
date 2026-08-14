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

export interface SchedulingAccess {
  canCancelOwn: boolean;
  canManageBlocks: boolean;
  canManageReservations: boolean;
  canReserve: boolean;
  canViewPrivateReservations: boolean;
}

export interface SchedulingRepository {
  createReservation(
    input: CreateReservationInput,
    context: SchedulingMutationContext,
  ): Promise<CreateReservationResult>;


  cancelReservation(
    laboratoryId: string,
    reservationId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation>;

  createTechnicalBlock(
    input: CreateTechnicalBlockInput,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock>;

  cancelTechnicalBlock(
    laboratoryId: string,
    technicalBlockId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock>;

  listSchedule(
    query: ListScheduleQuery,
    requestingUserId: string,
    access: SchedulingAccess,
  ): Promise<ScheduleResponse>;
}

export const SCHEDULING_REPOSITORY = Symbol('SCHEDULING_REPOSITORY');
