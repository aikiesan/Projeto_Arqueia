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
  pgm.addConstraint('catalog_options', 'catalog_options_laboratory_id_id_uk', {
    unique: ['laboratory_id', 'id'],
  });

  pgm.createTable('equipment', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    catalog_option_id: { type: 'uuid', notNull: true },
    space_option_id: { type: 'uuid' },
    bench_option_id: { type: 'uuid' },
    responsible_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    code: { type: 'varchar(64)', notNull: true },
    name: { type: 'varchar(180)', notNull: true },
    asset_tag: { type: 'varchar(96)' },
    serial_number: { type: 'varchar(160)' },
    status: {
      type: 'varchar(32)',
      notNull: true,
      default: 'AVAILABLE',
      check: "status IN ('AVAILABLE', 'UNDER_EVALUATION', 'UNAVAILABLE', 'MAINTENANCE')",
    },
    max_reservation_minutes: {
      type: 'integer',
      notNull: true,
      default: 720,
      check: 'max_reservation_minutes BETWEEN 30 AND 10080',
    },
    requires_training: { type: 'boolean', notNull: true, default: true },
    requires_approval: { type: 'boolean', notNull: true, default: false },
    absence_release_minutes: {
      type: 'integer',
      notNull: true,
      default: 30,
      check: 'absence_release_minutes BETWEEN 0 AND 240',
    },
    notes: { type: 'varchar(2000)' },
  });

  pgm.addConstraint('equipment', 'equipment_catalog_option_lab_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'catalog_option_id'],
      references: 'catalog_options(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('equipment', 'equipment_space_option_lab_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'space_option_id'],
      references: 'catalog_options(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('equipment', 'equipment_bench_option_lab_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'bench_option_id'],
      references: 'catalog_options(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.createIndex('equipment', ['laboratory_id', 'code'], {
    name: 'equipment_lab_code_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });
  pgm.createIndex('equipment', ['laboratory_id', 'status'], {
    name: 'equipment_lab_status_active_idx',
    where: 'archived_at IS NULL',
  });
  pgm.sql(`
    CREATE INDEX equipment_lab_name_active_idx
      ON equipment (laboratory_id, lower(name), id)
      WHERE archived_at IS NULL;

    CREATE TRIGGER equipment_set_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('equipment');
  pgm.dropConstraint('catalog_options', 'catalog_options_laboratory_id_id_uk');
};
