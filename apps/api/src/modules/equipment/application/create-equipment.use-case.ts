import type {
  AuthenticatedPrincipal,
  CreateEquipmentInput,
  Equipment,
} from '@arqueia/contracts';

import type {
  EquipmentMutationContext,
  EquipmentRepository,
} from '../domain/ports/equipment-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CreateEquipmentUseCase {
  public constructor(
    private readonly equipment: EquipmentRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateEquipmentInput,
    context: Omit<EquipmentMutationContext, 'actorId'>,
  ): Promise<Equipment> {
    this.permissions.assertCan(principal, 'equipment.manage', input.laboratoryId);
    return this.equipment.create(input, { ...context, actorId: principal.user.id });
  }
}
