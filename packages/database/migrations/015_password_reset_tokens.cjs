/* eslint-disable camelcase */

/**
 * Tokens de redefinição de senha — o "esqueci minha senha" do login local.
 *
 * Decisões gravadas no schema, e não só no código:
 *
 *   - A tabela guarda o SHA-256 do token, nunca o token. Quem consegue ler o
 *     banco (dump, réplica, backup) não consegue redefinir a senha de ninguém:
 *     o segredo só existe no e-mail enviado.
 *   - Um token é de uso único e tem prazo. `used_at` é a única coluna que muda
 *     depois do INSERT, e só de NULL para um instante; um gatilho recusa
 *     qualquer outra alteração e recusa DELETE. Isso deixa a tabela servir de
 *     trilha de uso, e não só de armazenamento (AGENTS.md §4.4 e §4.6).
 *   - `consumed_ok` não existe: um token válido é o que tem `used_at IS NULL`
 *     e `expires_at > now()`. O índice parcial abaixo é o que torna a consulta
 *     de consumo barata.
 *   - Não há coluna de IP nem de user-agent (ADR-009 §10). `origin` grava só
 *     de qual casca veio o pedido ('api:http', 'cli:password-reset').
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    token_hash: {
      type: 'char(64)',
      notNull: true,
      unique: true,
      check: "token_hash ~ '^[0-9a-f]{64}$'",
    },
    origin: { type: 'varchar(80)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
  });

  pgm.addConstraint('password_reset_tokens', 'password_reset_tokens_expiry_ck', {
    check: 'expires_at > created_at',
  });

  pgm.sql(`
    CREATE INDEX password_reset_tokens_pending_idx
      ON password_reset_tokens (user_id, expires_at DESC)
      WHERE used_at IS NULL;

    CREATE FUNCTION reject_password_reset_token_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'password_reset_tokens não aceita DELETE; o token expira sozinho.'
          USING ERRCODE = '55000';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
        OR NEW.origin IS DISTINCT FROM OLD.origin
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'Só "used_at" muda em um token de redefinição de senha.'
          USING ERRCODE = '55000';
      END IF;
      IF OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
        RAISE EXCEPTION 'Um token de redefinição de senha só é consumido uma vez.'
          USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER password_reset_tokens_single_use
    BEFORE UPDATE OR DELETE ON password_reset_tokens
    FOR EACH ROW EXECUTE FUNCTION reject_password_reset_token_mutation();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
  pgm.dropFunction('reject_password_reset_token_mutation', []);
};
