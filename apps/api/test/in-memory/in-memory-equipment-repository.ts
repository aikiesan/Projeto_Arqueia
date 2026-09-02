import { randomUUID } from 'node:crypto';

import {
  equipmentSchema,
  type CreateEquipmentInput,
  type Equipment,
  type EquipmentPage,
  type UpdateEquipmentInput,
} from '@arqueia/contracts';

import {
  EquipmentConflictError,
  EquipmentNotFoundError,
} from '../../src/modules/equipment/domain/equipment.errors.js';
import type {
  EquipmentListQuery,
  EquipmentMutationContext,
  EquipmentRepository,
} from '../../src/modules/equipment/domain/ports/equipment-repository.port.js';

export class InMemoryEquipmentRepository implements EquipmentRepository {
  public readonly equipments = new Map<string, Equipment>();

  public async list(query: EquipmentListQuery): Promise<EquipmentPage> {
    let items = Array.from(this.equipments.values()).filter(
      (e) => e.laboratoryId === query.laboratoryId && e.archivedAt === null,
    );

    if (query.status) {
      items = items.filter((e) => e.status === query.status);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          e.code.toLowerCase().includes(s) ||
          (e.assetTag && e.assetTag.toLowerCase().includes(s)) ||
          (e.serialNumber && e.serialNumber.toLowerCase().includes(s)),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    const limit = query.limit ?? 25;
    const paginated = items.slice(0, limit);
    return {
      items: paginated,
      pageInfo: {
        hasNextPage: items.length > limit,
        nextCursor: items.length > limit ? paginated[paginated.length - 1]!.id : null,
      },
    };
  }

  public async findActiveById(equipmentId: string): Promise<Equipment | null> {
    const equipment = this.equipments.get(equipmentId);
    if (!equipment || equipment.archivedAt !== null) return null;
    return equipment;
  }

  public async create(
    input: CreateEquipmentInput,
    _context: EquipmentMutationContext,
  ): Promise<Equipment> {
    const duplicate = Array.from(this.equipments.values()).find(
      (e) =>
        e.laboratoryId === input.laboratoryId &&
        e.code.toLowerCase() === input.code.toLowerCase() &&
        e.archivedAt === null,
    );
    if (duplicate) {
      throw new EquipmentConflictError();
    }

    const now = new Date().toISOString();
    const equipment = equipmentSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      catalogOptionId: input.catalogOptionId,
      spaceOptionId: input.spaceOptionId ?? null,
      benchOptionId: input.benchOptionId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      code: input.code,
      name: input.name,
      assetTag: input.assetTag ?? null,
      serialNumber: input.serialNumber ?? null,
      status: 'AVAILABLE',
      reservationPolicy: input.reservationPolicy ?? {
        maxReservationMinutes: 720,
        requiresTraining: true,
        requiresApproval: false,
        absenceReleaseMinutes: 30,
      },
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.equipments.set(equipment.id, equipment);
    return equipment;
  }

  public async update(
    equipmentId: string,
    input: UpdateEquipmentInput,
    _context: EquipmentMutationContext,
  ): Promise<Equipment> {
    const existing = this.equipments.get(equipmentId);
    if (!existing || existing.archivedAt !== null) {
      throw new EquipmentNotFoundError(equipmentId);
    }

    if (input.code && input.code.toLowerCase() !== existing.code.toLowerCase()) {
      const duplicate = Array.from(this.equipments.values()).find(
        (e) =>
          e.laboratoryId === existing.laboratoryId &&
          e.id !== equipmentId &&
          e.code.toLowerCase() === input.code!.toLowerCase() &&
          e.archivedAt === null,
      );
      if (duplicate) {
        throw new EquipmentConflictError();
      }
    }

    const now = new Date().toISOString();
    const updated = equipmentSchema.parse({
      ...existing,
      ...input,
      reservationPolicy: input.reservationPolicy
        ? { ...existing.reservationPolicy, ...input.reservationPolicy }
        : existing.reservationPolicy,
      updatedAt: now,
    });

    this.equipments.set(equipmentId, updated);
    return updated;
  }
}
