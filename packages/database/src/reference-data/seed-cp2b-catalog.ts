import type { DatabaseClient } from '../client.js';
import { buildCP2bReferenceCatalog } from './cp2b-catalog.js';

interface SourceRow {
  readonly id: string;
  readonly inserted: boolean;
}

interface MismatchCountRow {
  readonly mismatch_count: string | number;
}

export interface CP2bCatalogSeedResult {
  readonly sourceId: string;
  readonly sourceCreated: boolean;
  readonly sourceRowCount: number;
  readonly optionCount: number;
}

export async function seedCP2bReferenceCatalog(
  client: DatabaseClient,
  laboratoryId: string,
  actorId: string,
): Promise<CP2bCatalogSeedResult> {
  const catalog = buildCP2bReferenceCatalog();
  const sourceResult = await client.query<SourceRow>(
    `
      WITH seeded AS (
        INSERT INTO catalog_sources (
          laboratory_id, source_key, display_name, source_type, sha256, schema_version
        )
        VALUES ($1, $2, $3, 'SPREADSHEET', $4, $5)
        ON CONFLICT (laboratory_id, source_key) WHERE archived_at IS NULL
        DO NOTHING
        RETURNING id, true AS inserted
      )
      SELECT id, inserted FROM seeded
      UNION ALL
      SELECT id, false AS inserted
      FROM catalog_sources
      WHERE laboratory_id = $1 AND source_key = $2 AND archived_at IS NULL
      LIMIT 1
    `,
    [
      laboratoryId,
      catalog.source.key,
      catalog.source.displayName,
      catalog.source.sha256,
      catalog.source.schemaVersion,
    ],
  );
  const source = sourceResult.rows[0];
  if (source === undefined) throw new Error('Não foi possível obter a fonte do catálogo CP2b.');

  const serializedRows = catalog.rows.map((row) => ({
    sheet_name: row.sheetName,
    row_number: row.rowNumber,
    values: row.values,
    content_sha256: row.contentSha256,
  }));
  await client.query(
    `
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset($2::jsonb) AS row_data(
          sheet_name text,
          row_number integer,
          values jsonb,
          content_sha256 text
        )
      )
      INSERT INTO catalog_source_rows (
        source_id, sheet_name, row_number, values, content_sha256
      )
      SELECT $1, sheet_name, row_number, values, content_sha256
      FROM incoming
      ON CONFLICT (source_id, sheet_name, row_number) DO NOTHING
    `,
    [source.id, JSON.stringify(serializedRows)],
  );

  const mismatchResult = await client.query<MismatchCountRow>(
    `
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset($2::jsonb) AS row_data(
          sheet_name text,
          row_number integer,
          content_sha256 text
        )
      )
      SELECT count(*) AS mismatch_count
      FROM incoming
      JOIN catalog_source_rows stored
        ON stored.source_id = $1
       AND stored.sheet_name = incoming.sheet_name
       AND stored.row_number = incoming.row_number
      WHERE stored.content_sha256 <> incoming.content_sha256
    `,
    [source.id, JSON.stringify(serializedRows)],
  );
  const mismatchCount = Number(mismatchResult.rows[0]?.mismatch_count ?? 0);
  if (mismatchCount > 0) {
    throw new Error('A fonte CP2b existente diverge do snapshot imutável. Crie uma nova versão.');
  }

  const serializedOptions = catalog.options.map((option) => ({
    option_key: option.optionKey,
    parent_option_key: option.parentOptionKey,
    kind: option.kind,
    code: option.code,
    label: option.label,
    category: option.category,
    description: option.description,
    details: option.details,
    source_sheet: option.sourceSheet,
    source_row: option.sourceRow,
    source_column: option.sourceColumn,
    is_selectable: option.isSelectable,
  }));
  await client.query(
    `
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset($3::jsonb) AS option_data(
          option_key text,
          parent_option_key text,
          kind text,
          code text,
          label text,
          category text,
          description text,
          details jsonb,
          source_sheet text,
          source_row integer,
          source_column text,
          is_selectable boolean
        )
      )
      INSERT INTO catalog_options (
        laboratory_id,
        source_id,
        source_row_id,
        option_key,
        parent_option_key,
        kind,
        code,
        label,
        category,
        description,
        details,
        source_column,
        is_selectable
      )
      SELECT
        $1,
        $2,
        source_row.id,
        incoming.option_key,
        incoming.parent_option_key,
        incoming.kind,
        incoming.code,
        incoming.label,
        incoming.category,
        incoming.description,
        incoming.details,
        incoming.source_column,
        incoming.is_selectable
      FROM incoming
      JOIN catalog_source_rows source_row
        ON source_row.source_id = $2
       AND source_row.sheet_name = incoming.source_sheet
       AND source_row.row_number = incoming.source_row
      ON CONFLICT (laboratory_id, source_id, option_key) WHERE archived_at IS NULL
      DO UPDATE SET
        source_row_id = EXCLUDED.source_row_id,
        parent_option_key = EXCLUDED.parent_option_key,
        kind = EXCLUDED.kind,
        code = EXCLUDED.code,
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        details = EXCLUDED.details,
        source_column = EXCLUDED.source_column,
        is_selectable = EXCLUDED.is_selectable
      WHERE catalog_options.source_row_id IS DISTINCT FROM EXCLUDED.source_row_id
         OR catalog_options.parent_option_key IS DISTINCT FROM EXCLUDED.parent_option_key
         OR catalog_options.kind IS DISTINCT FROM EXCLUDED.kind
         OR catalog_options.code IS DISTINCT FROM EXCLUDED.code
         OR catalog_options.label IS DISTINCT FROM EXCLUDED.label
         OR catalog_options.category IS DISTINCT FROM EXCLUDED.category
         OR catalog_options.description IS DISTINCT FROM EXCLUDED.description
         OR catalog_options.details IS DISTINCT FROM EXCLUDED.details
         OR catalog_options.source_column IS DISTINCT FROM EXCLUDED.source_column
         OR catalog_options.is_selectable IS DISTINCT FROM EXCLUDED.is_selectable
    `,
    [laboratoryId, source.id, JSON.stringify(serializedOptions)],
  );

  await client.query(
    `
      UPDATE catalog_options child
      SET parent_option_id = parent.id
      FROM catalog_options parent
      WHERE child.laboratory_id = $1
        AND child.source_id = $2
        AND child.archived_at IS NULL
        AND child.parent_option_key IS NOT NULL
        AND parent.laboratory_id = child.laboratory_id
        AND parent.source_id = child.source_id
        AND parent.option_key = child.parent_option_key
        AND parent.archived_at IS NULL
        AND child.parent_option_id IS DISTINCT FROM parent.id
    `,
    [laboratoryId, source.id],
  );

  if (source.inserted) {
    await client.query(
      `
        INSERT INTO audit_events (
          actor_id, laboratory_id, action, entity, entity_id, before, after, origin
        )
        VALUES (
          $1,
          $2,
          'catalog.source.imported',
          'CatalogSource',
          $3,
          NULL,
          $4::jsonb,
          'database-seed'
        )
      `,
      [
        actorId,
        laboratoryId,
        source.id,
        JSON.stringify({
          sourceKey: catalog.source.key,
          sha256: catalog.source.sha256,
          sourceRowCount: catalog.rows.length,
          optionCount: catalog.options.length,
        }),
      ],
    );
  }

  return {
    sourceId: source.id,
    sourceCreated: source.inserted,
    sourceRowCount: catalog.rows.length,
    optionCount: catalog.options.length,
  };
}
