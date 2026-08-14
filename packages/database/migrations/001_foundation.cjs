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
  pgm.createExtension('btree_gist', { ifNotExists: true });

  pgm.sql(`
    CREATE FUNCTION set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $function$;

    CREATE FUNCTION reject_append_only_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '55000';
    END;
    $function$;
  `);

  pgm.createTable('institutions', {
    ...metadataColumns(pgm),
    name: { type: 'varchar(160)', notNull: true },
    acronym: { type: 'varchar(24)', notNull: true },
  });
  pgm.createIndex('institutions', 'acronym', {
    name: 'institutions_acronym_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('laboratories', {
    ...metadataColumns(pgm),
    institution_id: {
      type: 'uuid',
      notNull: true,
      references: 'institutions',
      onDelete: 'RESTRICT',
    },
    name: { type: 'varchar(160)', notNull: true },
    code: { type: 'varchar(32)', notNull: true },
    timezone: { type: 'varchar(64)', notNull: true, default: 'America/Sao_Paulo' },
  });
  pgm.createIndex('laboratories', ['institution_id', 'code'], {
    name: 'laboratories_institution_code_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('users', {
    ...metadataColumns(pgm),
    institution_id: {
      type: 'uuid',
      notNull: true,
      references: 'institutions',
      onDelete: 'RESTRICT',
    },
    supervisor_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    name: { type: 'varchar(120)', notNull: true },
    email: { type: 'varchar(254)', notNull: true },
    status: {
      type: 'varchar(16)',
      notNull: true,
      default: 'INVITED',
      check: "status IN ('INVITED', 'ACTIVE', 'SUSPENDED')",
    },
    identity_provider: {
      type: 'varchar(16)',
      notNull: true,
      default: 'LOCAL',
      check: "identity_provider IN ('LOCAL', 'OIDC', 'HYBRID')",
    },
  });
  pgm.sql(`
    CREATE UNIQUE INDEX users_email_active_uk
      ON users (lower(email))
      WHERE archived_at IS NULL;
  `);

  pgm.createTable('local_credentials', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    password_hash: { type: 'text', notNull: true },
    password_changed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    failed_attempts: { type: 'integer', notNull: true, default: 0, check: 'failed_attempts >= 0' },
    locked_until: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('memberships', {
    ...metadataColumns(pgm),
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    role: {
      type: 'varchar(40)',
      notNull: true,
      check: "role IN ('USUARIO', 'TECNICO', 'RESPONSAVEL_CONTROLADOS')",
    },
  });
  pgm.createIndex('memberships', ['user_id', 'laboratory_id', 'role'], {
    name: 'memberships_user_lab_role_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('system_role_assignments', {
    ...metadataColumns(pgm),
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    role: { type: 'varchar(16)', notNull: true, check: "role IN ('ADMIN')" },
  });
  pgm.createIndex('system_role_assignments', ['user_id', 'role'], {
    name: 'system_roles_user_role_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('projects', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    code: { type: 'varchar(48)', notNull: true },
    name: { type: 'varchar(180)', notNull: true },
    description: { type: 'varchar(2000)' },
    status: {
      type: 'varchar(16)',
      notNull: true,
      default: 'ACTIVE',
      check: "status IN ('ACTIVE', 'COMPLETED')",
    },
  });
  pgm.createIndex('projects', ['laboratory_id', 'code'], {
    name: 'projects_laboratory_code_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('auth_sessions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    refresh_token_hash: { type: 'text', notNull: true },
    ip_address: { type: 'inet' },
    user_agent: { type: 'varchar(512)' },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('auth_sessions', ['user_id', 'expires_at'], {
    name: 'auth_sessions_user_expiry_idx',
  });

  pgm.createTable('documents', {
    ...metadataColumns(pgm),
    laboratory_id: { type: 'uuid', references: 'laboratories', onDelete: 'RESTRICT' },
    owner_type: { type: 'varchar(48)', notNull: true },
    owner_id: { type: 'uuid', notNull: true },
    kind: { type: 'varchar(48)', notNull: true },
    title: { type: 'varchar(180)', notNull: true },
    version: { type: 'integer', notNull: true, check: 'version > 0' },
    author_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    valid_until: { type: 'date' },
    file_ref: { type: 'text', notNull: true },
    sha256: { type: 'char(64)', notNull: true },
    supersedes_document_id: { type: 'uuid', references: 'documents', onDelete: 'RESTRICT' },
  });
  pgm.createIndex('documents', ['owner_type', 'owner_id', 'kind', 'version'], {
    name: 'documents_owner_kind_version_uk',
    unique: true,
  });

  pgm.createTable('audit_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    actor_id: { type: 'uuid', references: 'users', onDelete: 'RESTRICT' },
    laboratory_id: { type: 'uuid', references: 'laboratories', onDelete: 'RESTRICT' },
    action: { type: 'varchar(120)', notNull: true },
    entity: { type: 'varchar(80)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    before: { type: 'jsonb' },
    after: { type: 'jsonb' },
    origin: { type: 'varchar(80)', notNull: true },
    request_id: { type: 'uuid' },
    occurred_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('audit_events', ['entity', 'entity_id', 'occurred_at'], {
    name: 'audit_events_entity_timeline_idx',
  });
  pgm.createIndex('audit_events', ['laboratory_id', 'occurred_at'], {
    name: 'audit_events_laboratory_timeline_idx',
  });

  for (const table of [
    'institutions',
    'laboratories',
    'users',
    'local_credentials',
    'memberships',
    'system_role_assignments',
    'projects',
    'auth_sessions',
    'documents',
  ]) {
    pgm.sql(`
      CREATE TRIGGER ${table}_set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  pgm.sql(`
    CREATE TRIGGER audit_events_append_only
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('audit_events');
  pgm.dropTable('documents');
  pgm.dropTable('auth_sessions');
  pgm.dropTable('projects');
  pgm.dropTable('system_role_assignments');
  pgm.dropTable('memberships');
  pgm.dropTable('local_credentials');
  pgm.dropTable('users');
  pgm.dropTable('laboratories');
  pgm.dropTable('institutions');
  pgm.dropFunction('reject_append_only_mutation', []);
  pgm.dropFunction('set_updated_at', []);
};
