import type {
  AuthenticatedPrincipal,
  CatalogOptionPage,
} from '@arqueia/contracts';

import type { CatalogAccessPolicy } from '../domain/ports/catalog-access-policy.port.js';
import type {
  CatalogOptionListQuery,
  CatalogOptionReader,
} from '../domain/ports/catalog-option-reader.port.js';

export class ListCatalogOptionsUseCase {
  public constructor(
    private readonly catalogOptions: CatalogOptionReader,
    private readonly accessPolicy: CatalogAccessPolicy,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    query: CatalogOptionListQuery,
  ): Promise<CatalogOptionPage> {
    this.accessPolicy.assertCanRead(principal, query.laboratoryId, query.kind);
    return this.catalogOptions.list(query);
  }
}
