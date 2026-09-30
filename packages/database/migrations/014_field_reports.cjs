/* eslint-disable camelcase */

/**
 * Informes — avisos enviados pela etiqueta QR, sem login, para a coordenação.
 *
 * Quatro tipos: problema em equipamento, necessidade de manutenção, uso de
 * insumo/reagente e informe geral (pedido de apoio). Quem envia não tem conta;
 * quem lê precisa de `field-report.review` no laboratório.
 *
 * Decisões gravadas no schema, e não só no código:
 *
 *   - O que o aluno escreveu não muda depois de enviado. A coordenação só
 *     tria (status, nota, revisor). Um gatilho recusa UPDATE nas colunas de
 *     conteúdo e recusa DELETE: exclusão é arquivamento (AGENTS.md §4.6).
 *   - O equipamento, quando informado, pertence ao mesmo laboratório do
 *     informe: FK composta para `equipment(laboratory_id, id)`.
 *   - Não há coluna de IP nem de user-agent (ADR-009 §10). O limite de envios
 *     por origem vive só em memória, na API.
 *   - Uso de insumo aqui é AVISO, não movimento: `stock_movements` continua
 *     sendo a única fonte do saldo (AGENTS.md §4.1).
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('field_reports', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    archived_at: { type: 'timestamptz' },
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    equipment_id: { type: 'uuid' },
    kind: {
      type: 'varchar(32)',
      notNull: true,
      check:
        "kind IN ('EQUIPMENT_PROBLEM', 'MAINTENANCE_REQUEST', 'SUPPLY_USAGE', 'GENERAL_SUPPORT')",
    },
    status: {
      type: 'varchar(16)',
      notNull: true,
      default: 'NEW',
      check: "status IN ('NEW', 'IN_REVIEW', 'RESOLVED')",
    },
    message: {
      type: 'varchar(2000)',
      notNull: true,
      check: 'char_length(btrim(message)) >= 10',
    },
    blocks_use: { type: 'boolean', notNull: true, default: false },
    reporter_name: { type: 'varchar(120)' },
    reporter_contact: { type: 'varchar(160)' },
    review_note: { type: 'varchar(1000)' },
    reviewed_by_user_id: { type: 'uuid', references: 'users', onDelete: 'RESTRICT' },
    reviewed_at: { type: 'timestamptz' },
  });

  pgm.addConstraint('field_reports', 'field_reports_equipment_lab_fk', {
    foreignKeys: {
      columns: ['laboratory_id', 'equipment_id'],
      references: 'equipment(laboratory_id, id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('field_reports', 'field_reports_review_pair_ck', {
    check: '(reviewed_by_user_id IS NULL) = (reviewed_at IS NULL)',
  });

  pgm.sql(`
    CREATE INDEX field_reports_lab_timeline_active_idx
      ON field_reports (laboratory_id, created_at DESC, id DESC)
      WHERE archived_at IS NULL;

    CREATE INDEX field_reports_lab_status_active_idx
      ON field_reports (laboratory_id, status, kind)
      WHERE archived_at IS NULL;

    CREATE TRIGGER field_reports_set_updated_at
    BEFORE UPDATE ON field_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE FUNCTION reject_field_report_content_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'field_reports não aceita DELETE; arquive o informe.'
          USING ERRCODE = '55000';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.laboratory_id IS DISTINCT FROM OLD.laboratory_id
        OR NEW.equipment_id IS DISTINCT FROM OLD.equipment_id
        OR NEW.kind IS DISTINCT FROM OLD.kind
        OR NEW.message IS DISTINCT FROM OLD.message
        OR NEW.blocks_use IS DISTINCT FROM OLD.blocks_use
        OR NEW.reporter_name IS DISTINCT FROM OLD.reporter_name
        OR NEW.reporter_contact IS DISTINCT FROM OLD.reporter_contact
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'O conteúdo de um informe não pode ser alterado depois de enviado.'
          USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER field_reports_content_immutable
    BEFORE UPDATE OR DELETE ON field_reports
    FOR EACH ROW EXECUTE FUNCTION reject_field_report_content_mutation();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('field_reports');
  pgm.dropFunction('reject_field_report_content_mutation', []);
};
