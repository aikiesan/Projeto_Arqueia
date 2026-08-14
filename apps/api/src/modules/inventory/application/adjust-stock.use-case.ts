import type {
  AdjustStockInput,
  AuthenticatedPrincipal,
  StockMovement,
} from '@arqueia/contracts';

import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class AdjustStockUseCase {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: AdjustStockInput,
    context: Omit<InventoryMutationContext, 'actorId'>,
  ): Promise<StockMovement> {
    this.permissions.assertCan(principal, 'inventory.manage', input.laboratoryId);
    return this.repository.adjustStock(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
