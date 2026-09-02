/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // 1. Add started_at and completed_at columns to reservations for real-world check-in / checkout
  pgm.addColumns('reservations', {
    started_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
  });

  // 2. Drop old check constraint and add expanded status check constraint on equipment_occupations
  pgm.dropConstraint('equipment_occupations', 'equipment_occupations_status_check');
  pgm.addConstraint('equipment_occupations', 'equipment_occupations_status_check', {
    check: "status IN ('CONFIRMED', 'IN_PROGRESS', 'ACTIVE', 'CANCELLED', 'COMPLETED', 'RELEASED_ABSENCE')",
  });

  // 3. Update exclusion constraint to ignore RELEASED_ABSENCE as well as CANCELLED
  pgm.dropConstraint('equipment_occupations', 'equipment_occupations_no_overlap_excl');
  pgm.sql(`
    ALTER TABLE equipment_occupations
      ADD CONSTRAINT equipment_occupations_no_overlap_excl
      EXCLUDE USING gist (
        equipment_id WITH =,
        period WITH &&
      ) WHERE (archived_at IS NULL AND status NOT IN ('CANCELLED', 'RELEASED_ABSENCE'));
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropConstraint('equipment_occupations', 'equipment_occupations_no_overlap_excl');
  pgm.sql(`
    ALTER TABLE equipment_occupations
      ADD CONSTRAINT equipment_occupations_no_overlap_excl
      EXCLUDE USING gist (
        equipment_id WITH =,
        period WITH &&
      ) WHERE (archived_at IS NULL AND status != 'CANCELLED');
  `);

  pgm.dropConstraint('equipment_occupations', 'equipment_occupations_status_check');
  pgm.addConstraint('equipment_occupations', 'equipment_occupations_status_check', {
    check: "status IN ('CONFIRMED', 'ACTIVE', 'CANCELLED', 'COMPLETED')",
  });

  pgm.dropColumns('reservations', ['started_at', 'completed_at']);
};
