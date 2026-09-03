/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN name varchar(120),
      ADD COLUMN email varchar(254);

    UPDATE users
       SET name = 'Conta migrada ' || login_code,
           email = lower(login_code) || '@pending.arqueia.unicamp.br',
           status = 'SUSPENDED';

    ALTER TABLE users
      ALTER COLUMN name SET NOT NULL,
      ALTER COLUMN email SET NOT NULL;

    CREATE UNIQUE INDEX users_email_active_uk
      ON users (lower(email))
      WHERE archived_at IS NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS users_email_active_uk;
    ALTER TABLE users DROP COLUMN email, DROP COLUMN name;
  `);
};
