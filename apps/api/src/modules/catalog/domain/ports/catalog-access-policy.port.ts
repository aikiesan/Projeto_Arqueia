import type { AuthenticatedPrincipal, CatalogOptionKind } from '@arqueia/contracts';

export interface CatalogAccessPolicy {
  assertCanRead(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
    kind: CatalogOptionKind,
  ): void;
}

export const CATALOG_ACCESS_POLICY = Symbol('CATALOG_ACCESS_POLICY');
