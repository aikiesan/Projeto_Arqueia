import type {
  AuthenticatedPrincipal,
  Equipment,
  UpdateEquipmentInput,
} from '@arqueia/contracts';

import { EquipmentNotFoundError } from '../domain/equipment.errors.js';
import type {
  EquipmentMutationContext,
  EquipmentRepository,
} from '../domain/ports/equipment-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class UpdateEquipmentUseCase {
  public constructor(
    private readonly equipment: EquipmentRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    equipmentId: string,
    input: UpdateEquipmentInput,
    context: Omit<EquipmentMutationContext, 'actorId'>,
  ): Promise<Equipment> {
    const current = await this.equipment.findActiveById(equipmentId);
    if (current === null) throw new EquipmentNotFoundError(equipmentId);
    this.permissions.assertCan(principal, 'equipment.manage', current.laboratoryId);
    return this.equipment.update(equipmentId, input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
