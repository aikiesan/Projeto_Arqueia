import type {
  AuthenticatedPrincipal,
  ListProductsQuery,
  ProductPage,
} from '@arqueia/contracts';

import type { InventoryRepository } from '../domain/ports/inventory-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class ListProductsUseCase {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: ListProductsQuery,
  ): Promise<ProductPage> {
    this.permissions.assertCan(principal, 'inventory.read', query.laboratoryId);
    return this.repository.listProducts(query);
  }
}
