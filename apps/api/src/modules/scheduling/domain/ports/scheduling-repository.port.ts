import type {
  CreateReservationInput,
  CreateReservationResult,
  CreateTechnicalBlockInput,
  ListScheduleQuery,
  ReleaseAbsentReservationsResult,
  Reservation,
  ScheduleResponse,
  StartWalkInReservationInput,
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

  startWalkInReservation(
    input: StartWalkInReservationInput,
    context: SchedulingMutationContext,
  ): Promise<Reservation>;

  checkInReservation(
    laboratoryId: string,
    reservationId: string,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation>;

  /**
   * Check-in a partir da leitura do QR físico do equipamento.
   *
   * Sem parâmetro canManageReservations por decisão de projeto: como o alvo é
   * implícito (o adesivo na bancada), um aprovador lendo o QR faria check-in
   * silencioso na reserva de outra pessoa, gravando started_at no nome dela.
   * Este fluxo resolve apenas a reserva do próprio ator; o bypass de aprovador
   * continua existindo só no check-in explícito por reservationId.
   */
  checkInReservationByEquipment(
    laboratoryId: string,
    equipmentId: string,
    context: SchedulingMutationContext,
  ): Promise<Reservation>;

  completeReservation(
    laboratoryId: string,
    reservationId: string,
    notes: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation>;

  releaseAbsentReservations(
    laboratoryId: string,
    context: SchedulingMutationContext,
  ): Promise<ReleaseAbsentReservationsResult>;

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
