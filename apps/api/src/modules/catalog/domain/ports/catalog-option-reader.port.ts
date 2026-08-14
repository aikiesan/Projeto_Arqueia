import type {
  CatalogOptionKind,
  CatalogOptionPage,
} from '@arqueia/contracts';

export interface CatalogOptionListQuery {
  laboratoryId: string;
  kind: CatalogOptionKind;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface CatalogOptionReader {
  list(query: CatalogOptionListQuery): Promise<CatalogOptionPage>;
}

export const CATALOG_OPTION_READER = Symbol('CATALOG_OPTION_READER');
