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
  pgm.createTable('equipment_occupations', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    equipment_id: {
      type: 'uuid',
      notNull: true,
      references: 'equipment',
      onDelete: 'RESTRICT',
    },
    occupation_type: {
      type: 'varchar(24)',
      notNull: true,
      check: "occupation_type IN ('RESERVATION', 'TECHNICAL_BLOCK')",
    },
    starts_at: { type: 'timestamptz', notNull: true },
    ends_at: { type: 'timestamptz', notNull: true },
    status: {
      type: 'varchar(16)',
      notNull: true,
      default: 'CONFIRMED',
      check: "status IN ('CONFIRMED', 'ACTIVE', 'CANCELLED', 'COMPLETED')",
    },
  });

  pgm.sql(`
    ALTER TABLE equipment_occupations
      ADD COLUMN period tstzrange
      GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED;
  `);

  pgm.addConstraint('equipment_occupations', 'equipment_occupations_starts_before_ends_check', {
    check: 'starts_at < ends_at',
  });

  pgm.sql(`
    ALTER TABLE equipment_occupations
      ADD CONSTRAINT equipment_occupations_no_overlap_excl
      EXCLUDE USING gist (
        equipment_id WITH =,
        period WITH &&
      ) WHERE (archived_at IS NULL AND status != 'CANCELLED');
  `);


  pgm.createIndex('equipment_occupations', ['laboratory_id', 'starts_at', 'ends_at'], {
    name: 'equipment_occupations_lab_period_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createIndex('equipment_occupations', ['equipment_id', 'starts_at', 'ends_at'], {
    name: 'equipment_occupations_equipment_period_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createTable('reservations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      references: 'equipment_occupations',
      onDelete: 'RESTRICT',
    },
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    equipment_id: {
      type: 'uuid',
      notNull: true,
      references: 'equipment',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects',
      onDelete: 'RESTRICT',
    },
    purpose: { type: 'varchar(500)', notNull: true },
    sample_count: {
      type: 'integer',
      check: 'sample_count BETWEEN 1 AND 10000',
    },
    notes: { type: 'varchar(2000)' },
    cancelled_at: { type: 'timestamptz' },
    cancelled_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    cancellation_reason: { type: 'varchar(500)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    archived_at: { type: 'timestamptz' },
  });

  pgm.createIndex('reservations', ['laboratory_id', 'user_id'], {
    name: 'reservations_lab_user_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createIndex('reservations', ['laboratory_id', 'project_id'], {
    name: 'reservations_lab_project_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createTable('technical_blocks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      references: 'equipment_occupations',
      onDelete: 'RESTRICT',
    },
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    equipment_id: {
      type: 'uuid',
      notNull: true,
      references: 'equipment',
      onDelete: 'RESTRICT',
    },
    created_by_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    reason: {
      type: 'varchar(32)',
      notNull: true,
      check: "reason IN ('MAINTENANCE', 'CALIBRATION', 'INTERRUPTED_SERVICE', 'OTHER')",
    },
    description: { type: 'varchar(1000)', notNull: true },
    cancelled_at: { type: 'timestamptz' },
    cancelled_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    archived_at: { type: 'timestamptz' },
  });

  for (const table of ['equipment_occupations', 'reservations', 'technical_blocks']) {
    pgm.sql(`
      CREATE TRIGGER ${table}_set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('technical_blocks');
  pgm.dropTable('reservations');
  pgm.dropTable('equipment_occupations');
};
