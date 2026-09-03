import { randomUUID } from 'node:crypto';

import { createDatabasePool, type DatabasePool } from '@arqueia/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InsufficientStockError } from '../domain/inventory.errors.js';
import { PostgresInventoryRepository } from './postgres-inventory-repository.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(databaseUrl === undefined)('PostgresInventoryRepository concurrency integration', () => {
  let pool: DatabasePool;
  let repository: PostgresInventoryRepository;

  const institutionId = randomUUID();
  const laboratoryId = randomUUID();
  const userId = randomUUID();
  const suffix = laboratoryId.slice(0, 8);

  let batchId: string;

  const context = {
    actorId: userId,
    origin: 'api:integration-test',
    requestId: randomUUID(),
  };

  beforeAll(async () => {
    pool = createDatabasePool({ connectionString: databaseUrl!, maxConnections: 4 });
    await pool.query('SELECT 1');
    repository = new PostgresInventoryRepository(pool);

    await pool.query(
      `INSERT INTO institutions (id, name, acronym)
       VALUES ($1, 'Inventory integration institution', $2)`,
      [institutionId, `INV-${suffix}`],
    );
    await pool.query(
      `INSERT INTO laboratories (id, institution_id, name, code, timezone)
       VALUES ($1, $2, 'Inventory integration laboratory', 'INV', 'America/Sao_Paulo')`,
      [laboratoryId, institutionId],
    );
    await pool.query(
      `INSERT INTO users (
         id, institution_id, login_code, name, email, academic_category, status
       ) VALUES ($1, $2, $3, 'Inventory integration user', $4, 'PESQUISADOR', 'ACTIVE')`,
      [
        userId,
        institutionId,
        `ARQ-INV-${suffix.toUpperCase()}`,
        `inventory-${suffix}@unicamp.br`,
      ],
    );

    const product = await repository.createProduct(
      {
        laboratoryId,
        code: `PRODUCT-${suffix}`,
        name: 'Concurrent withdrawal product',
        category: 'REAGENT',
        unitOfMeasure: 'ML',
        minimumStockThreshold: 0,
      },
      context,
    );
    const batch = await repository.createBatchEntry(
      {
        laboratoryId,
        productId: product.id,
        batchNumber: `BATCH-${suffix}`,
        initialQuantity: 100,
      },
      context,
    );
    batchId = batch.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('allows exactly one of two competing withdrawals and preserves the derived balance', async () => {
    const withdraw = () =>
      repository.withdrawStock(
        {
          laboratoryId,
          batchId,
          quantity: 60,
          purpose: 'Concurrent integration withdrawal',
        },
        context,
      );

    const results = await Promise.allSettled([withdraw(), withdraw()]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: expect.any(InsufficientStockError) });

    const ledger = await pool.query<{
      derived_balance: string;
      latest_balance_after: string;
      withdrawal_count: string;
    }>(
      `SELECT
         SUM(CASE
           WHEN movement_type = 'ENTRY' THEN quantity
           WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity
           WHEN movement_type = 'ADJUSTMENT' THEN quantity
           ELSE 0
         END) AS derived_balance,
         (array_agg(balance_after ORDER BY performed_at DESC, id DESC))[1] AS latest_balance_after,
         COUNT(*) FILTER (WHERE movement_type = 'WITHDRAWAL') AS withdrawal_count
       FROM stock_movements
       WHERE batch_id = $1`,
      [batchId],
    );

    expect(Number(ledger.rows[0]?.derived_balance)).toBe(40);
    expect(Number(ledger.rows[0]?.latest_balance_after)).toBe(40);
    expect(Number(ledger.rows[0]?.withdrawal_count)).toBe(1);
  });
});
