import { randomUUID } from 'node:crypto';

import {
  CANCELLATION_MINIMUM_NOTICE_MINUTES,
  reservationSchema,
  scheduleResponseSchema,
  technicalBlockSchema,
  type CreateReservationInput,
  type CreateReservationResult,
  type CreateTechnicalBlockInput,
  type ListScheduleQuery,
  type ReleaseAbsentReservationsResult,
  type Reservation,
  type ScheduleItem,
  type ScheduleItemStatus,
  type ScheduleResponse,
  type StartWalkInReservationInput,
  type TechnicalBlock,
} from '@arqueia/contracts';

import {
  EquipmentUnavailableError,
  ReservationCancellationNoticeError,
  ReservationCheckInError,
  ReservationCompletionError,
  ReservationConflictError,
  ReservationNotFoundError,
  TechnicalBlockNotFoundError,
} from '../../src/modules/scheduling/domain/scheduling.errors.js';
import { generateRecurrentSlots } from '../../src/modules/scheduling/domain/recurrence.js';
import type {
  SchedulingAccess,
  SchedulingMutationContext,
  SchedulingRepository,
} from '../../src/modules/scheduling/domain/ports/scheduling-repository.port.js';

export interface InMemoryEquipmentInfo {
  readonly id: string;
  readonly laboratoryId: string;
  readonly name: string;
  readonly status: 'AVAILABLE' | 'UNDER_EVALUATION' | 'UNAVAILABLE' | 'MAINTENANCE';
  readonly maxReservationMinutes: number;
  readonly requiresTraining: boolean;
  readonly requiresApproval: boolean;
  readonly absenceReleaseMinutes?: number;
}

export class InMemorySchedulingRepository implements SchedulingRepository {
  public readonly reservations = new Map<string, Reservation>();
  public readonly technicalBlocks = new Map<string, TechnicalBlock>();
  public readonly equipments = new Map<string, InMemoryEquipmentInfo>();
  public clock: () => Date = () => new Date();

  public constructor() {
    // Default fallback equipment for tests
    const defaultEq: InMemoryEquipmentInfo = {
      id: '22222222-2222-4222-a222-222222222222',
      laboratoryId: '11111111-1111-4111-a111-111111111111',
      name: 'Cromatógrafo HPLC CP2b',
      status: 'AVAILABLE',
      maxReservationMinutes: 720,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    };
    this.equipments.set(defaultEq.id, defaultEq);
  }

  public registerEquipment(equipment: InMemoryEquipmentInfo): void {
    this.equipments.set(equipment.id, equipment);
  }

  private overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
    const tStartA = new Date(startA).getTime();
    const tEndA = new Date(endA).getTime();
    const tStartB = new Date(startB).getTime();
    const tEndB = new Date(endB).getTime();
    return tStartA < tEndB && tEndA > tStartB;
  }

  public async createReservation(
    input: CreateReservationInput,
    context: SchedulingMutationContext,
  ): Promise<CreateReservationResult> {
    const equipment = this.equipments.get(input.equipmentId);
    if (equipment) {
      if (equipment.status !== 'AVAILABLE') {
        throw new EquipmentUnavailableError(equipment.status);
      }
    }

    const slots = generateRecurrentSlots(input.startsAt, input.endsAt, input.recurrence);
    const createdReservations: Reservation[] = [];
    const conflictingSlots: Array<{ startsAt: string; endsAt: string; reason: string }> = [];

    for (const slot of slots) {
      if (equipment) {
        const durationMinutes =
          (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;
        if (durationMinutes > equipment.maxReservationMinutes) {
          throw new Error(
            `A duração da reserva (${durationMinutes} min) excede o limite do equipamento (${equipment.maxReservationMinutes} min).`,
          );
        }
      }

      let hasConflict = false;

      // Check conflicts with active/confirmed reservations
      for (const res of this.reservations.values()) {
        if (
          res.equipmentId === input.equipmentId &&
          (res.status === 'CONFIRMED' || res.status === 'IN_PROGRESS') &&
          res.archivedAt === null
        ) {
          if (this.overlaps(slot.startsAt, slot.endsAt, res.startsAt, res.endsAt)) {
            hasConflict = true;
            conflictingSlots.push({
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              reason: 'O equipamento já possui um agendamento neste horário.',
            });
            break;
          }
        }
      }

      if (!hasConflict) {
        // Check conflicts with active technical blocks
        for (const block of this.technicalBlocks.values()) {
          if (
            block.equipmentId === input.equipmentId &&
            block.status === 'ACTIVE' &&
            block.archivedAt === null
          ) {
            if (this.overlaps(slot.startsAt, slot.endsAt, block.startsAt, block.endsAt)) {
              hasConflict = true;
              conflictingSlots.push({
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                reason: `Bloqueio técnico: ${block.reason}`,
              });
              break;
            }
          }
        }
      }

      if (!hasConflict) {
        const now = this.clock().toISOString();
        const reservation = reservationSchema.parse({
          id: randomUUID(),
          laboratoryId: input.laboratoryId,
          equipmentId: input.equipmentId,
          userId: context.actorId,
          projectId: input.projectId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: 'CONFIRMED',
          purpose: input.purpose,
          sampleCount: input.sampleCount ?? null,
          notes: input.notes ?? null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelledByUserId: null,
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });

        this.reservations.set(reservation.id, reservation);
        createdReservations.push(reservation);
      }
    }

    if (createdReservations.length === 0 && conflictingSlots.length > 0) {
      throw new ReservationConflictError(
        conflictingSlots[0]!.startsAt,
        conflictingSlots[0]!.endsAt,
      );
    }

    return {
      createdReservations,
      conflictingSlots,
    };
  }

  public async startWalkInReservation(
    input: StartWalkInReservationInput,
    context: SchedulingMutationContext,
  ): Promise<Reservation> {
    const equipment = this.equipments.get(input.equipmentId);
    if (equipment) {
      if (equipment.status !== 'AVAILABLE') {
        throw new EquipmentUnavailableError(equipment.status);
      }
      if (input.durationMinutes > equipment.maxReservationMinutes) {
        throw new Error(
          `A duração solicitada (${input.durationMinutes} min) excede o limite do equipamento (${equipment.maxReservationMinutes} min).`,
        );
      }
    }

    const now = this.clock();
    const startsAt = now.toISOString();
    const endsAt = new Date(now.getTime() + input.durationMinutes * 60_000).toISOString();

    // Check collision
    for (const res of this.reservations.values()) {
      if (
        res.equipmentId === input.equipmentId &&
        (res.status === 'CONFIRMED' || res.status === 'IN_PROGRESS') &&
        res.archivedAt === null
      ) {
        if (this.overlaps(startsAt, endsAt, res.startsAt, res.endsAt)) {
          throw new ReservationConflictError(startsAt, endsAt);
        }
      }
    }
    for (const block of this.technicalBlocks.values()) {
      if (
        block.equipmentId === input.equipmentId &&
        block.status === 'ACTIVE' &&
        block.archivedAt === null
      ) {
        if (this.overlaps(startsAt, endsAt, block.startsAt, block.endsAt)) {
          throw new ReservationConflictError(startsAt, endsAt);
        }
      }
    }

    const reservation = reservationSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      equipmentId: input.equipmentId,
      userId: context.actorId,
      projectId: input.projectId,
      startsAt,
      endsAt,
      status: 'IN_PROGRESS',
      purpose: input.purpose,
      sampleCount: input.sampleCount ?? null,
      notes: input.notes ?? null,
      startedAt: startsAt,
      completedAt: null,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
      createdAt: startsAt,
      updatedAt: startsAt,
      archivedAt: null,
    });

    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  public async checkInReservation(
    laboratoryId: string,
    reservationId: string,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    const res = this.reservations.get(reservationId);
    if (!res || res.laboratoryId !== laboratoryId || res.archivedAt !== null) {
      throw new ReservationNotFoundError(reservationId);
    }

    if (!canManageReservations && res.userId !== context.actorId) {
      throw new Error('Você não tem permissão para fazer check-in nesta reserva.');
    }

    if (res.status === 'IN_PROGRESS') {
      return res;
    }

    if (res.status !== 'CONFIRMED') {
      throw new ReservationCheckInError(`Não é possível iniciar reserva com status ${res.status}.`);
    }

    const now = this.clock().toISOString();
    const updated = reservationSchema.parse({
      ...res,
      status: 'IN_PROGRESS',
      startedAt: now,
      updatedAt: now,
    });

    this.reservations.set(reservationId, updated);
    return updated;
  }

  public async completeReservation(
    laboratoryId: string,
    reservationId: string,
    notes: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    const res = this.reservations.get(reservationId);
    if (!res || res.laboratoryId !== laboratoryId || res.archivedAt !== null) {
      throw new ReservationNotFoundError(reservationId);
    }

    if (!canManageReservations && res.userId !== context.actorId) {
      throw new Error('Você não tem permissão para finalizar esta reserva.');
    }

    if (res.status === 'COMPLETED') {
      return res;
    }

    if (res.status !== 'IN_PROGRESS' && res.status !== 'CONFIRMED') {
      throw new ReservationCompletionError(`Não é possível finalizar reserva com status ${res.status}.`);
    }

    const now = this.clock().toISOString();
    const updated = reservationSchema.parse({
      ...res,
      status: 'COMPLETED',
      completedAt: now,
      notes: notes ? `${res.notes ?? ''} ${notes}`.trim() : res.notes,
      updatedAt: now,
    });

    this.reservations.set(reservationId, updated);
    return updated;
  }

  public async releaseAbsentReservations(
    laboratoryId: string,
    _context: SchedulingMutationContext,
  ): Promise<ReleaseAbsentReservationsResult> {
    const now = this.clock().getTime();
    const releasedReservationIds: string[] = [];

    for (const [id, res] of this.reservations.entries()) {
      if (res.laboratoryId !== laboratoryId || res.status !== 'CONFIRMED' || res.archivedAt !== null) {
        continue;
      }
      const eq = this.equipments.get(res.equipmentId);
      const toleranceMinutes = eq?.absenceReleaseMinutes ?? 30;
      const thresholdTime = new Date(res.startsAt).getTime() + toleranceMinutes * 60_000;

      if (now > thresholdTime) {
        const updated = reservationSchema.parse({
          ...res,
          status: 'RELEASED_ABSENCE',
          updatedAt: new Date(now).toISOString(),
        });
        this.reservations.set(id, updated);
        releasedReservationIds.push(id);
      }
    }

    return {
      releasedCount: releasedReservationIds.length,
      releasedReservationIds,
    };
  }

  public async cancelReservation(
    laboratoryId: string,
    reservationId: string,
    reason: string | undefined,
    context: SchedulingMutationContext,
    canManageReservations: boolean,
  ): Promise<Reservation> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.laboratoryId !== laboratoryId || reservation.archivedAt !== null) {
      throw new ReservationNotFoundError(reservationId);
    }

    const now = this.clock();
    const startsAt = new Date(reservation.startsAt);

    if (!canManageReservations) {
      if (reservation.userId !== context.actorId) {
        throw new Error('Você não tem permissão para cancelar esta reserva.');
      }
      if (reservation.status === 'CANCELLED' || reservation.status === 'RELEASED_ABSENCE') {
        return reservation;
      }
      const noticeMinutes = (startsAt.getTime() - now.getTime()) / 60000;
      if (noticeMinutes < CANCELLATION_MINIMUM_NOTICE_MINUTES) {
        throw new ReservationCancellationNoticeError();
      }
    } else if (reservation.status === 'CANCELLED' || reservation.status === 'RELEASED_ABSENCE') {
      return reservation;
    }

    const nowIso = now.toISOString();
    const updated = reservationSchema.parse({
      ...reservation,
      status: 'CANCELLED',
      cancelledAt: nowIso,
      cancelledByUserId: context.actorId,
      cancellationReason: reason ?? null,
      updatedAt: nowIso,
    });

    this.reservations.set(reservationId, updated);
    return updated;
  }

  public async createTechnicalBlock(
    input: CreateTechnicalBlockInput,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock> {
    for (const res of this.reservations.values()) {
      if (
        res.equipmentId === input.equipmentId &&
        (res.status === 'CONFIRMED' || res.status === 'IN_PROGRESS') &&
        res.archivedAt === null
      ) {
        if (this.overlaps(input.startsAt, input.endsAt, res.startsAt, res.endsAt)) {
          throw new ReservationConflictError(res.startsAt, res.endsAt);
        }
      }
    }

    const now = this.clock().toISOString();
    const block = technicalBlockSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      equipmentId: input.equipmentId,
      createdByUserId: context.actorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: 'ACTIVE',
      reason: input.reason,
      description: input.description,
      cancelledAt: null,
      cancelledByUserId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.technicalBlocks.set(block.id, block);
    return block;
  }

  public async cancelTechnicalBlock(
    laboratoryId: string,
    technicalBlockId: string,
    _reason: string | undefined,
    context: SchedulingMutationContext,
  ): Promise<TechnicalBlock> {
    const block = this.technicalBlocks.get(technicalBlockId);
    if (!block || block.laboratoryId !== laboratoryId || block.archivedAt !== null) {
      throw new TechnicalBlockNotFoundError(technicalBlockId);
    }

    const now = this.clock().toISOString();
    const updated = technicalBlockSchema.parse({
      ...block,
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledByUserId: context.actorId,
      updatedAt: now,
    });

    this.technicalBlocks.set(technicalBlockId, updated);
    return updated;
  }

  public async listSchedule(
    query: ListScheduleQuery,
    requestingUserId: string,
    access: SchedulingAccess,
  ): Promise<ScheduleResponse> {
    const queryStart = new Date(query.startsAt).getTime();
    const queryEnd = new Date(query.endsAt).getTime();

    const items: ScheduleItem[] = [];

    // Filter reservations
    for (const res of this.reservations.values()) {
      if (res.laboratoryId !== query.laboratoryId || res.archivedAt !== null) continue;
      if (query.equipmentId && res.equipmentId !== query.equipmentId) continue;
      if (!query.includeCancelled && (res.status === 'CANCELLED' || res.status === 'RELEASED_ABSENCE')) {
        continue;
      }
      if (query.onlyMine && res.userId !== requestingUserId) continue;

      const rStart = new Date(res.startsAt).getTime();
      const rEnd = new Date(res.endsAt).getTime();
      if (rStart < queryEnd && rEnd > queryStart) {
        const isMine = res.userId === requestingUserId;
        const canSeeDetails = access.canViewPrivateReservations || isMine;
        const status = res.status as ScheduleItemStatus;
        const canControl = access.canManageReservations || isMine;

        const equipment = this.equipments.get(res.equipmentId);
        const equipmentName = equipment?.name ?? 'Equipamento CP2b';

        items.push({
          id: res.id,
          type: 'RESERVATION',
          equipmentId: res.equipmentId,
          equipmentName,
          startsAt: res.startsAt,
          endsAt: res.endsAt,
          title: canSeeDetails ? `Reserva: ${res.purpose}` : 'Equipamento Reservado',
          status,
          isMine,
          canCancel:
            status !== 'CANCELLED' &&
            status !== 'RELEASED_ABSENCE' &&
            status !== 'COMPLETED' &&
            (access.canManageReservations || (isMine && access.canCancelOwn)),
          canCheckIn: status === 'CONFIRMED' && canControl,
          canComplete: (status === 'IN_PROGRESS' || status === 'CONFIRMED') && canControl,
          reservationDetails: canSeeDetails
            ? {
                reservationId: res.id,
                userId: res.userId,
                userName: 'Pesquisador',
                projectId: res.projectId,
                projectCode: 'PRJ-CP2B-01',
                purpose: res.purpose,
                sampleCount: res.sampleCount ?? undefined,
                notes: res.notes ?? undefined,
                startedAt: res.startedAt ?? undefined,
                completedAt: res.completedAt ?? undefined,
                status: res.status,
              }
            : null,
        });
      }
    }

    // Filter technical blocks
    for (const block of this.technicalBlocks.values()) {
      if (block.laboratoryId !== query.laboratoryId || block.archivedAt !== null) continue;
      if (query.equipmentId && block.equipmentId !== query.equipmentId) continue;
      if (!query.includeCancelled && block.status === 'CANCELLED') continue;

      const bStart = new Date(block.startsAt).getTime();
      const bEnd = new Date(block.endsAt).getTime();
      if (bStart < queryEnd && bEnd > queryStart) {
        const status = block.status as ScheduleItemStatus;
        const equipment = this.equipments.get(block.equipmentId);
        const equipmentName = equipment?.name ?? 'Equipamento CP2b';

        items.push({
          id: block.id,
          type: 'TECHNICAL_BLOCK',
          equipmentId: block.equipmentId,
          equipmentName,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          title: `Bloqueio técnico: ${block.reason}`,
          status,
          isMine: false,
          canCancel: status !== 'CANCELLED' && access.canManageBlocks,
          canCheckIn: false,
          canComplete: false,
          blockDetails: access.canManageBlocks
            ? {
                technicalBlockId: block.id,
                reason: block.reason,
                description: block.description,
                createdByUserId: block.createdByUserId,
                status: block.status as 'ACTIVE' | 'CANCELLED',
              }
            : null,
        });
      }
    }

    items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return scheduleResponseSchema.parse({
      laboratoryId: query.laboratoryId,
      timezone: 'America/Sao_Paulo',
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      capabilities: {
        canReserve: access.canReserve,
        canManageBlocks: access.canManageBlocks,
      },
      items,
    });
  }
}
