/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

const metadataColumns = (pgm) => ({
  id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
  created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  archived_at: { type: 'timestamptz' },
});

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('catalog_sources', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    source_key: { type: 'varchar(160)', notNull: true },
    display_name: { type: 'varchar(240)', notNull: true },
    source_type: {
      type: 'varchar(24)',
      notNull: true,
      check: "source_type IN ('SPREADSHEET')",
    },
    sha256: { type: 'char(64)', notNull: true },
    schema_version: { type: 'integer', notNull: true, check: 'schema_version > 0' },
    imported_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('catalog_sources', ['laboratory_id', 'source_key'], {
    name: 'catalog_sources_lab_key_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('catalog_source_rows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    source_id: {
      type: 'uuid',
      notNull: true,
      references: 'catalog_sources',
      onDelete: 'RESTRICT',
    },
    sheet_name: { type: 'varchar(120)', notNull: true },
    row_number: { type: 'integer', notNull: true, check: 'row_number > 0' },
    values: {
      type: 'jsonb',
      notNull: true,
      check: "jsonb_typeof(values) = 'array'",
    },
    content_sha256: { type: 'char(64)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('catalog_source_rows', ['source_id', 'sheet_name', 'row_number'], {
    name: 'catalog_source_rows_source_sheet_row_uk',
    unique: true,
  });

  pgm.createTable('catalog_options', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    source_id: {
      type: 'uuid',
      notNull: true,
      references: 'catalog_sources',
      onDelete: 'RESTRICT',
    },
    source_row_id: {
      type: 'uuid',
      notNull: true,
      references: 'catalog_source_rows',
      onDelete: 'RESTRICT',
    },
    parent_option_id: {
      type: 'uuid',
      references: 'catalog_options',
      onDelete: 'RESTRICT',
    },
    option_key: { type: 'varchar(240)', notNull: true },
    parent_option_key: { type: 'varchar(240)' },
    kind: {
      type: 'varchar(32)',
      notNull: true,
      check:
        "kind IN ('REAGENT', 'MATERIAL', 'EQUIPMENT_TYPE', 'EQUIPMENT_MODEL', 'SPACE', 'BENCH', 'FURNITURE', 'PLANNING_ASSUMPTION')",
    },
    code: { type: 'varchar(96)' },
    label: { type: 'varchar(500)', notNull: true },
    category: { type: 'varchar(160)' },
    description: { type: 'varchar(2000)' },
    details: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
      check: "jsonb_typeof(details) = 'object'",
    },
    source_column: { type: 'varchar(8)' },
    is_selectable: { type: 'boolean', notNull: true, default: true },
  });
  pgm.createIndex('catalog_options', ['laboratory_id', 'source_id', 'option_key'], {
    name: 'catalog_options_lab_source_key_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });
  pgm.createIndex('catalog_options', ['laboratory_id', 'kind'], {
    name: 'catalog_options_lab_kind_active_idx',
    where: 'archived_at IS NULL',
  });
  pgm.sql(`
    CREATE INDEX catalog_options_lab_label_active_idx
      ON catalog_options (laboratory_id, lower(label), id)
      WHERE archived_at IS NULL;

    CREATE TRIGGER catalog_sources_set_updated_at
    BEFORE UPDATE ON catalog_sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER catalog_options_set_updated_at
    BEFORE UPDATE ON catalog_options
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER catalog_source_rows_append_only
    BEFORE UPDATE OR DELETE ON catalog_source_rows
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

    UPDATE laboratories
    SET name = replace(name, 'CP2B', 'CP2b'),
        code = replace(code, 'CP2B', 'CP2b')
    WHERE name LIKE '%CP2B%' OR code LIKE '%CP2B%';

    UPDATE projects
    SET name = replace(name, 'CP2B', 'CP2b'),
        code = replace(code, 'CP2B', 'CP2b'),
        description = replace(description, 'CP2B', 'CP2b')
    WHERE name LIKE '%CP2B%'
       OR code LIKE '%CP2B%'
       OR description LIKE '%CP2B%';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('catalog_options');
  pgm.dropTable('catalog_source_rows');
  pgm.dropTable('catalog_sources');
};
