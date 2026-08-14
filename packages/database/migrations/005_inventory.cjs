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
  pgm.createTable('products', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    code: { type: 'varchar(64)', notNull: true },
    name: { type: 'varchar(180)', notNull: true },
    cas_number: { type: 'varchar(32)' },
    category: {
      type: 'varchar(32)',
      notNull: true,
      check: "category IN ('REAGENT', 'SOLVENT', 'CONSUMABLE', 'GLASSWARE', 'STANDARD', 'OTHER')",
    },
    unit_of_measure: {
      type: 'varchar(32)',
      notNull: true,
      check: "unit_of_measure IN ('ML', 'L', 'G', 'KG', 'UNIDADE', 'CAIXA', 'FRASCO', 'PACOTE')",
    },
    minimum_stock_threshold: { type: 'numeric(12,4)', notNull: true, default: 0 },
    description: { type: 'varchar(2000)' },
  });

  pgm.createIndex('products', ['laboratory_id', 'code'], {
    name: 'products_lab_code_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('batches', {
    ...metadataColumns(pgm),
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'products',
      onDelete: 'RESTRICT',
    },
    batch_number: { type: 'varchar(80)', notNull: true },
    manufacturer: { type: 'varchar(160)' },
    expiration_date: { type: 'timestamptz' },
    received_date: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    space_option_id: { type: 'uuid' },
    bench_option_id: { type: 'uuid' },
    initial_quantity: { type: 'numeric(12,4)', notNull: true },
    qr_code: { type: 'varchar(120)', notNull: true },
    status: {
      type: 'varchar(16)',
      notNull: true,
      default: 'AVAILABLE',
      check: "status IN ('AVAILABLE', 'EXPIRED', 'EXHAUSTED', 'DISCARDED')",
    },
    notes: { type: 'varchar(2000)' },
  });

  pgm.createIndex('batches', ['laboratory_id', 'product_id'], {
    name: 'batches_lab_product_idx',
    where: 'archived_at IS NULL',
  });

  pgm.createIndex('batches', ['qr_code'], {
    name: 'batches_qr_code_active_uk',
    unique: true,
    where: 'archived_at IS NULL',
  });

  pgm.createTable('stock_movements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    laboratory_id: {
      type: 'uuid',
      notNull: true,
      references: 'laboratories',
      onDelete: 'RESTRICT',
    },
    batch_id: {
      type: 'uuid',
      notNull: true,
      references: 'batches',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'products',
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
      references: 'projects',
      onDelete: 'RESTRICT',
    },
    movement_type: {
      type: 'varchar(16)',
      notNull: true,
      check: "movement_type IN ('ENTRY', 'WITHDRAWAL', 'ADJUSTMENT', 'DISCARD')",
    },
    quantity: { type: 'numeric(12,4)', notNull: true },
    balance_after: { type: 'numeric(12,4)', notNull: true },
    purpose: { type: 'varchar(500)' },
    reason: { type: 'varchar(1000)' },
    performed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('stock_movements', ['batch_id', 'performed_at'], {
    name: 'stock_movements_batch_timeline_idx',
  });

  pgm.createIndex('stock_movements', ['laboratory_id', 'performed_at'], {
    name: 'stock_movements_lab_timeline_idx',
  });

  for (const table of ['products', 'batches']) {
    pgm.sql(`
      CREATE TRIGGER ${table}_set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  pgm.sql(`
    CREATE TRIGGER stock_movements_append_only
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('stock_movements');
  pgm.dropTable('batches');
  pgm.dropTable('products');
};
