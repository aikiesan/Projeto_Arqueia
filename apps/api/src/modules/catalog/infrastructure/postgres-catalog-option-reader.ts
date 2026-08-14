import {
  catalogOptionSchema,
  type CatalogOption,
  type CatalogOptionPage,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

import type {
  CatalogOptionListQuery,
  CatalogOptionReader,
} from '../domain/ports/catalog-option-reader.port.js';

interface CatalogOptionRow {
  id: string;
  laboratory_id: string;
  parent_option_id: string | null;
  kind: string;
  code: string | null;
  label: string;
  category: string | null;
  description: string | null;
  details: unknown;
  is_selectable: boolean;
  source_key: string;
  sheet_name: string;
  row_number: number;
  source_column: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

const LIST_OPTIONS_SQL = `
  SELECT co.id, co.laboratory_id, co.parent_option_id, co.kind, co.code,
         co.label, co.category, co.description, co.details, co.is_selectable,
         co.source_column, co.created_at, co.updated_at, co.archived_at,
         cs.source_key, csr.sheet_name, csr.row_number
    FROM catalog_options co
    JOIN catalog_sources cs
      ON cs.id = co.source_id
     AND cs.laboratory_id = co.laboratory_id
     AND cs.archived_at IS NULL
    JOIN catalog_source_rows csr
      ON csr.id = co.source_row_id
     AND csr.source_id = co.source_id
   WHERE co.laboratory_id = $1
     AND co.kind = $2
     AND co.archived_at IS NULL
     AND ($3::text IS NULL OR co.label ILIKE $3 ESCAPE '\\')
     AND (
       $4::uuid IS NULL OR (lower(co.label), co.id) > (
         SELECT lower(cursor_option.label), cursor_option.id
           FROM catalog_options cursor_option
          WHERE cursor_option.id = $4
            AND cursor_option.laboratory_id = $1
            AND cursor_option.kind = $2
            AND cursor_option.archived_at IS NULL
       )
     )
   ORDER BY lower(co.label), co.id
   LIMIT $5
`;

function escapedLikeSearch(search: string | undefined): string | null {
  if (search === undefined) return null;
  return `%${search.replace(/[\\%_]/g, '\\$&')}%`;
}

function timestamp(value: Date): string {
  return value.toISOString();
}

function mapCatalogOption(row: CatalogOptionRow): CatalogOption {
  return catalogOptionSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    parentOptionId: row.parent_option_id,
    kind: row.kind,
    code: row.code,
    label: row.label,
    category: row.category,
    description: row.description,
    details: row.details,
    isSelectable: row.is_selectable,
    source: {
      key: row.source_key,
      sheet: row.sheet_name,
      row: row.row_number,
      column: row.source_column,
    },
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at === null ? null : timestamp(row.archived_at),
  });
}

export class PostgresCatalogOptionReader implements CatalogOptionReader {
  public constructor(private readonly pool: DatabasePool) {}

  public async list(query: CatalogOptionListQuery): Promise<CatalogOptionPage> {
    const result = await this.pool.query<CatalogOptionRow>(LIST_OPTIONS_SQL, [
      query.laboratoryId,
      query.kind,
      escapedLikeSearch(query.search),
      query.cursor ?? null,
      query.limit + 1,
    ]);
    const hasNextPage = result.rows.length > query.limit;
    const items = result.rows.slice(0, query.limit).map(mapCatalogOption);

    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }
}
