import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';

import type { LaboratoryReader } from '../domain/ports/laboratory-repository.port.js';
import type { PermissionEvaluator } from '../domain/services/permission-evaluator.js';
import { activeLaboratoryIds, isGlobalAdministrator } from './identity-scope.js';

export class ListLaboratoriesUseCase {
  public constructor(
    private readonly laboratories: LaboratoryReader,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(principal: AuthenticatedPrincipal): Promise<readonly Laboratory[]> {
    if (isGlobalAdministrator(principal)) {
      this.permissions.assertCan(principal, 'identity.laboratory.read');
      return this.laboratories.listVisibleTo(null);
    }

    const laboratoryIds = activeLaboratoryIds(principal).filter((laboratoryId) =>
      this.permissions.can(principal, 'identity.laboratory.read', laboratoryId),
    );
    return this.laboratories.listVisibleTo(laboratoryIds);
  }
}
