import type { AuthenticatedPrincipal, EquipmentPage } from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import type {
  EquipmentListQuery,
  EquipmentRepository,
} from '../domain/ports/equipment-repository.port.js';

export class ListEquipmentUseCase {
  public constructor(
    private readonly equipment: EquipmentRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: EquipmentListQuery,
  ): Promise<EquipmentPage> {
    this.permissions.assertCan(principal, 'equipment.read', query.laboratoryId);
    return this.equipment.list(query);
  }
}
