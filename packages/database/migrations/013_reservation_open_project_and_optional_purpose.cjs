/* eslint-disable camelcase */

/**
 * Projeto vira texto livre e finalidade deixa de ser obrigatória.
 *
 * Decisão do laboratório: o aluno escreve o projeto em vez de escolher de uma
 * lista, e pode deixar a finalidade em branco.
 *
 * `project_id` é PRESERVADO, apenas passa a aceitar nulo. As reservas já
 * gravadas continuam ligadas aos projetos cadastrados, e o relatório de uso por
 * projeto segue somando o histórico. As reservas novas passam a trazer
 * `project_label` preenchido e `project_id` nulo.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.alterColumn('reservations', 'project_id', { notNull: false });
  pgm.alterColumn('reservations', 'purpose', { notNull: false });

  pgm.addColumns('reservations', {
    project_label: {
      type: 'varchar(200)',
      notNull: false,
      comment: 'Projeto escrito livremente pelo usuário. Substitui a escolha em lista.',
    },
  });

  // O relatório de uso por projeto passa a agrupar também por texto digitado.
  pgm.createIndex('reservations', ['laboratory_id', 'project_label'], {
    name: 'reservations_lab_project_label_idx',
    where: 'archived_at IS NULL AND project_label IS NOT NULL',
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 *
 * A volta só é possível se não houver linha que dependa da permissividade nova.
 * Falhar aqui é melhor do que inventar um projeto ou uma finalidade para
 * satisfazer o NOT NULL.
 */
exports.down = (pgm) => {
  pgm.dropIndex('reservations', ['laboratory_id', 'project_label'], {
    name: 'reservations_lab_project_label_idx',
  });
  pgm.dropColumns('reservations', ['project_label']);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM reservations WHERE project_id IS NULL OR purpose IS NULL) THEN
        RAISE EXCEPTION 'Existem reservas sem projeto ou sem finalidade; preencha-as antes de reverter.';
      END IF;
    END $$;
  `);
  pgm.alterColumn('reservations', 'project_id', { notNull: true });
  pgm.alterColumn('reservations', 'purpose', { notNull: true });
};
