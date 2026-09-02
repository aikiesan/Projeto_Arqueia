/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN login_code varchar(32),
      ADD COLUMN academic_category varchar(24),
      ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;

    UPDATE users
       SET login_code = 'ARQ-' || upper(substr(replace(id::text, '-', ''), 1, 12)),
           academic_category = 'PESQUISADOR';

    ALTER TABLE users
      ALTER COLUMN login_code SET NOT NULL,
      ALTER COLUMN academic_category SET NOT NULL,
      ADD CONSTRAINT users_login_code_format_ck
        CHECK (login_code ~ '^[A-Z0-9-]{6,32}$'),
      ADD CONSTRAINT users_academic_category_ck
        CHECK (academic_category IN ('IC', 'MESTRADO', 'DOUTORADO', 'POS_DOUTORADO', 'PESQUISADOR'));

    CREATE UNIQUE INDEX users_login_code_active_uk
      ON users (upper(login_code))
      WHERE archived_at IS NULL;

    DROP INDEX IF EXISTS users_email_active_uk;
    ALTER TABLE users
      DROP COLUMN supervisor_user_id,
      DROP COLUMN name,
      DROP COLUMN email,
      DROP COLUMN identity_provider;

    ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
    ALTER TABLE memberships
      ADD CONSTRAINT memberships_role_check
      CHECK (role IN ('USUARIO', 'GESTOR_ACESSO_CP2B', 'TECNICO', 'RESPONSAVEL_CONTROLADOS'));

    ALTER TABLE auth_sessions
      DROP COLUMN ip_address,
      DROP COLUMN user_agent;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE auth_sessions
      ADD COLUMN ip_address inet,
      ADD COLUMN user_agent varchar(512);

    ALTER TABLE users
      ADD COLUMN supervisor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      ADD COLUMN name varchar(120),
      ADD COLUMN email varchar(254),
      ADD COLUMN identity_provider varchar(16) NOT NULL DEFAULT 'LOCAL';

    UPDATE users
       SET name = login_code,
           email = lower(login_code) || '@invalid.arqueia.local';

    ALTER TABLE users
      ALTER COLUMN name SET NOT NULL,
      ALTER COLUMN email SET NOT NULL,
      ADD CONSTRAINT users_identity_provider_check
        CHECK (identity_provider IN ('LOCAL', 'OIDC', 'HYBRID'));

    CREATE UNIQUE INDEX users_email_active_uk
      ON users (lower(email))
      WHERE archived_at IS NULL;

    DROP INDEX IF EXISTS users_login_code_active_uk;
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_login_code_format_ck,
      DROP CONSTRAINT IF EXISTS users_academic_category_ck,
      DROP COLUMN login_code,
      DROP COLUMN academic_category,
      DROP COLUMN must_change_password;

    ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
    ALTER TABLE memberships
      ADD CONSTRAINT memberships_role_check
      CHECK (role IN ('USUARIO', 'TECNICO', 'RESPONSAVEL_CONTROLADOS'));
  `);
};
