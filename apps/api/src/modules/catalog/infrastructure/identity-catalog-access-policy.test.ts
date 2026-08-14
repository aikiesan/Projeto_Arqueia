import type { AuthenticatedPrincipal, IdentityPermission } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { IdentityCatalogAccessPolicy } from './identity-catalog-access-policy.js';

describe('IdentityCatalogAccessPolicy', () => {
  it.each([
    ['REAGENT', 'inventory.read'],
    ['MATERIAL', 'inventory.read'],
    ['EQUIPMENT_TYPE', 'equipment.read'],
    ['EQUIPMENT_MODEL', 'equipment.read'],
    ['SPACE', 'identity.laboratory.read'],
    ['BENCH', 'identity.laboratory.read'],
    ['FURNITURE', 'identity.laboratory.read'],
    ['PLANNING_ASSUMPTION', 'identity.laboratory.read'],
  ] as const)('maps %s to the least-privilege permission %s', (kind, permission) => {
    const assertCan = vi.fn<(
      principal: AuthenticatedPrincipal,
      permission: IdentityPermission,
      laboratoryId?: string,
    ) => void>();
    const evaluator = { assertCan } as unknown as PermissionEvaluator;
    const principal = {} as AuthenticatedPrincipal;
    const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

    new IdentityCatalogAccessPolicy(evaluator).assertCanRead(principal, laboratoryId, kind);

    expect(assertCan).toHaveBeenCalledWith(principal, permission, laboratoryId);
  });
});
