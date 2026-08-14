import type {
  AuthenticatedPrincipal,
  Batch,
  CreateBatchInput,
} from '@arqueia/contracts';

import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class CreateBatchEntryUseCase {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CreateBatchInput,
    context: Omit<InventoryMutationContext, 'actorId'>,
  ): Promise<Batch> {
    this.permissions.assertCan(principal, 'inventory.manage', input.laboratoryId);
    return this.repository.createBatchEntry(input, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
