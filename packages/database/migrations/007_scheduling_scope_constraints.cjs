/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.addConstraint('equipment', 'equipment_laboratory_id_id_uk', {
    unique: ['laboratory_id', 'id'],
  });
  pgm.addConstraint('projects', 'projects_laboratory_id_id_uk', {
    unique: ['laboratory_id', 'id'],
  });
  pgm.addConstraint(
    'equipment_occupations',
    'equipment_occupations_laboratory_equipment_id_uk',
    {
      unique: ['laboratory_id', 'equipment_id', 'id'],
    },
  );

  pgm.addConstraint('equipment_occupations', 'equipment_occupations_equipment_scope_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'equipment_id'],
      references: 'equipment(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('reservations', 'reservations_occupation_scope_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'equipment_id', 'id'],
      references: 'equipment_occupations(laboratory_id, equipment_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('reservations', 'reservations_project_scope_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'project_id'],
      references: 'projects(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('technical_blocks', 'technical_blocks_occupation_scope_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'equipment_id', 'id'],
      references: 'equipment_occupations(laboratory_id, equipment_id, id)',
      onDelete: 'RESTRICT',
    },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropConstraint('technical_blocks', 'technical_blocks_occupation_scope_fk');
  pgm.dropConstraint('reservations', 'reservations_project_scope_fk');
  pgm.dropConstraint('reservations', 'reservations_occupation_scope_fk');
  pgm.dropConstraint('equipment_occupations', 'equipment_occupations_equipment_scope_fk');
  pgm.dropConstraint(
    'equipment_occupations',
    'equipment_occupations_laboratory_equipment_id_uk',
  );
  pgm.dropConstraint('projects', 'projects_laboratory_id_id_uk');
  pgm.dropConstraint('equipment', 'equipment_laboratory_id_id_uk');
};
