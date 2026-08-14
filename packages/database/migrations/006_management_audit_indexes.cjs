/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createIndex('audit_events', ['actor_id', { name: 'occurred_at', sort: 'DESC' }, { name: 'id', sort: 'DESC' }], {
    name: 'audit_events_actor_timeline_idx',
  });

  pgm.createIndex('audit_events', ['laboratory_id', { name: 'occurred_at', sort: 'DESC' }, { name: 'id', sort: 'DESC' }], {
    name: 'audit_events_lab_timeline_cursor_idx',
    where: 'laboratory_id IS NOT NULL',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropIndex('audit_events', [], { name: 'audit_events_lab_timeline_cursor_idx' });
  pgm.dropIndex('audit_events', [], { name: 'audit_events_actor_timeline_idx' });
};
