import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentPage,
  EquipmentStatus,
  UpdateEquipmentInput,
} from '@arqueia/contracts';

export interface EquipmentMutationContext {
  readonly actorId: string;
  readonly origin: string;
  readonly requestId: string | null;
}

export interface EquipmentListQuery {
  readonly laboratoryId: string;
  readonly status?: EquipmentStatus;
  readonly search?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface EquipmentRepository {
  list(query: EquipmentListQuery): Promise<EquipmentPage>;
  findActiveById(equipmentId: string): Promise<Equipment | null>;
  /**
   * Resolve o identificador lido de uma etiqueta de QR — UUID ou código
   * legível — sem exigir laboratório. Quem restringe o acesso é o caso de uso,
   * depois de saber a qual laboratório o equipamento pertence.
   */
  findActiveByQrIdentifier(identifier: string): Promise<Equipment | null>;
  create(input: CreateEquipmentInput, context: EquipmentMutationContext): Promise<Equipment>;
  update(
    equipmentId: string,
    input: UpdateEquipmentInput,
    context: EquipmentMutationContext,
  ): Promise<Equipment>;
}

export const EQUIPMENT_REPOSITORY = Symbol('EQUIPMENT_REPOSITORY');
