import type {
  AuthenticatedPrincipal,
  StockMovement,
  WithdrawStockInput,
} from '@arqueia/contracts';

import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class WithdrawStockUseCase {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: WithdrawStockInput,
    context: Omit<InventoryMutationContext, 'actorId'>,
  ): Promise<StockMovement> {
    this.permissions.assertCan(principal, 'inventory.withdraw', input.laboratoryId);
    return this.repository.withdrawStock(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
