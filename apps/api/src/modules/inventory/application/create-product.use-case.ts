import type {
  AuthenticatedPrincipal,
  CreateProductInput,
  Product,
} from '@arqueia/contracts';

import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CreateProductUseCase {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateProductInput,
    context: Omit<InventoryMutationContext, 'actorId'>,
  ): Promise<Product> {
    this.permissions.assertCan(principal, 'inventory.manage', input.laboratoryId);
    return this.repository.createProduct(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
