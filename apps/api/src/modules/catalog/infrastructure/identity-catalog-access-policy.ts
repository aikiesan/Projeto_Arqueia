import type {
  AuthenticatedPrincipal,
  CatalogOptionKind,
  IdentityPermission,
} from '@arqueia/contracts';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import type { CatalogAccessPolicy } from '../domain/ports/catalog-access-policy.port.js';

const PERMISSION_BY_KIND: Readonly<Record<CatalogOptionKind, IdentityPermission>> = {
  REAGENT: 'inventory.read',
  MATERIAL: 'inventory.read',
  EQUIPMENT_TYPE: 'equipment.read',
  EQUIPMENT_MODEL: 'equipment.read',
  SPACE: 'identity.laboratory.read',
  BENCH: 'identity.laboratory.read',
  FURNITURE: 'identity.laboratory.read',
  PLANNING_ASSUMPTION: 'identity.laboratory.read',
};

export class IdentityCatalogAccessPolicy implements CatalogAccessPolicy {
  public constructor(private readonly permissions: PermissionEvaluator) {}

  public assertCanRead(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
    kind: CatalogOptionKind,
  ): void {
    this.permissions.assertCan(principal, PERMISSION_BY_KIND[kind], laboratoryId);
  }
}
