/* eslint-disable camelcase */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE FUNCTION enforce_stock_movement_ledger_consistency()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      previous_balance numeric(12,4);
      expected_balance numeric(12,4);
    BEGIN
      -- Serialize every writer for a batch, including direct SQL writers that
      -- bypass the application repository.
      PERFORM 1
        FROM batches
       WHERE id = NEW.batch_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % does not exist', NEW.batch_id
          USING ERRCODE = '23503';
      END IF;

      IF NEW.movement_type IN ('ENTRY', 'WITHDRAWAL', 'DISCARD') AND NEW.quantity <= 0 THEN
        RAISE EXCEPTION '% quantity must be positive', NEW.movement_type
          USING ERRCODE = '23514',
                CONSTRAINT = 'stock_movements_quantity_semantics_check';
      END IF;

      IF NEW.movement_type = 'ADJUSTMENT' AND NEW.quantity = 0 THEN
        RAISE EXCEPTION 'ADJUSTMENT quantity must be non-zero'
          USING ERRCODE = '23514',
                CONSTRAINT = 'stock_movements_quantity_semantics_check';
      END IF;

      SELECT COALESCE(
        SUM(
          CASE
            WHEN movement_type = 'ENTRY' THEN quantity
            WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity
            WHEN movement_type = 'ADJUSTMENT' THEN quantity
            ELSE 0
          END
        ),
        0
      )
      INTO previous_balance
      FROM stock_movements
      WHERE batch_id = NEW.batch_id;

      expected_balance := previous_balance + CASE
        WHEN NEW.movement_type = 'ENTRY' THEN NEW.quantity
        WHEN NEW.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -NEW.quantity
        WHEN NEW.movement_type = 'ADJUSTMENT' THEN NEW.quantity
        ELSE 0
      END;

      IF expected_balance < 0 OR NEW.balance_after IS DISTINCT FROM expected_balance THEN
        RAISE EXCEPTION
          'Invalid ledger balance for batch %: expected %, received %',
          NEW.batch_id,
          expected_balance,
          NEW.balance_after
          USING ERRCODE = '23514',
                CONSTRAINT = 'stock_movements_ledger_consistency_check';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER stock_movements_ledger_consistency
    BEFORE INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION enforce_stock_movement_ledger_consistency();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS stock_movements_ledger_consistency ON stock_movements;');
  pgm.dropFunction('enforce_stock_movement_ledger_consistency', []);
};
