import {
  batchSchema,
  productSchema,
  stockMovementSchema,
  type AdjustStockInput,
  type Batch,
  type BatchPage,
  type CreateBatchInput,
  type CreateProductInput,
  type ListBatchesQuery,
  type ListProductsQuery,
  type ListStockMovementsQuery,
  type Product,
  type ProductPage,
  type StockMovement,
  type StockMovementPage,
  type WithdrawStockInput,
} from '@arqueia/contracts';
import { inTransaction, type DatabaseClient, type DatabasePool } from '@arqueia/database';

import {
  BatchNotFoundError,
  InsufficientStockError,
  ProductConflictError,
  ProductNotFoundError,
} from '../domain/inventory.errors.js';
import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';

interface PgError {
  code?: string;
}

interface ProductRow {
  id: string;
  laboratory_id: string;
  code: string;
  name: string;
  cas_number: string | null;
  category: string;
  unit_of_measure: string;
  minimum_stock_threshold: string | number;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface BatchRow {
  id: string;
  laboratory_id: string;
  product_id: string;
  batch_number: string;
  manufacturer: string | null;
  expiration_date: Date | null;
  received_date: Date;
  space_option_id: string | null;
  bench_option_id: string | null;
  initial_quantity: string | number;
  current_balance?: string | number;
  qr_code: string;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

interface StockMovementRow {
  id: string;
  laboratory_id: string;
  batch_id: string;
  product_id: string;
  user_id: string;
  project_id: string | null;
  movement_type: 'ENTRY' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'DISCARD';
  quantity: string | number;
  balance_after: string | number;
  purpose: string | null;
  reason: string | null;
  performed_at: Date;
  created_at: Date;
  updated_at?: Date;
  archived_at?: Date | null;
}

function timestamp(value: Date): string {
  return value.toISOString();
}

function mapProduct(row: ProductRow): Product {
  return productSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    code: row.code,
    name: row.name,
    casNumber: row.cas_number,
    category: row.category,
    unitOfMeasure: row.unit_of_measure,
    minimumStockThreshold: Number(row.minimum_stock_threshold),
    description: row.description,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at ? timestamp(row.archived_at) : null,
  });
}

function mapBatch(row: BatchRow, currentBalance: number): Batch {
  return batchSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    manufacturer: row.manufacturer,
    expirationDate: row.expiration_date ? timestamp(row.expiration_date) : null,
    receivedDate: timestamp(row.received_date),
    spaceOptionId: row.space_option_id,
    benchOptionId: row.bench_option_id,
    initialQuantity: Number(row.initial_quantity),
    currentBalance,
    qrCode: row.qr_code,
    status: row.status,
    notes: row.notes,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    archivedAt: row.archived_at ? timestamp(row.archived_at) : null,
  });
}

function mapMovement(row: StockMovementRow): StockMovement {
  return stockMovementSchema.parse({
    id: row.id,
    laboratoryId: row.laboratory_id,
    batchId: row.batch_id,
    productId: row.product_id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.movement_type,
    quantity: Number(row.quantity),
    balanceAfter: Number(row.balance_after),
    purpose: row.purpose,
    reason: row.reason,
    performedAt: timestamp(row.performed_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.created_at),
    archivedAt: null,
  });
}

async function appendAudit(
  client: DatabaseClient,
  context: InventoryMutationContext,
  laboratoryId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown | null,
  after: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       actor_id, laboratory_id, action, entity, entity_id,
       before, after, origin, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      context.actorId,
      laboratoryId,
      action,
      entity,
      entityId,
      before === null ? null : JSON.stringify(before),
      JSON.stringify(after),
      context.origin,
      context.requestId,
    ],
  );
}

async function calculateBatchBalance(
  client: DatabasePool | DatabaseClient,
  batchId: string,
): Promise<number> {
  const result = await client.query<{ balance: string | number }>(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN movement_type = 'ENTRY' THEN quantity
           WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity
           WHEN movement_type = 'ADJUSTMENT' THEN balance_after - (
             SELECT COALESCE(SUM(
               CASE
                 WHEN m2.movement_type = 'ENTRY' THEN m2.quantity
                 WHEN m2.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -m2.quantity
                 ELSE 0
               END
             ), 0)
               FROM stock_movements m2
              WHERE m2.batch_id = $1 AND m2.created_at < stock_movements.created_at
           )
           ELSE 0
         END
       ), 0
     ) AS balance
     FROM stock_movements
    WHERE batch_id = $1`,
    [batchId],
  );
  return Math.max(0, Number(result.rows[0]?.balance ?? 0));
}

export class PostgresInventoryRepository implements InventoryRepository {
  public constructor(private readonly pool: DatabasePool) {}

  public async createProduct(
    input: CreateProductInput,
    context: InventoryMutationContext,
  ): Promise<Product> {
    try {
      return await inTransaction(this.pool, async (client) => {
        const result = await client.query<ProductRow>(
          `INSERT INTO products (
             laboratory_id, code, name, cas_number, category, unit_of_measure,
             minimum_stock_threshold, description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, laboratory_id, code, name, cas_number, category, unit_of_measure, minimum_stock_threshold, description, created_at, updated_at, archived_at`,
          [
            input.laboratoryId,
            input.code,
            input.name,
            input.casNumber ?? null,
            input.category,
            input.unitOfMeasure,
            input.minimumStockThreshold ?? 0,
            input.description ?? null,
          ],
        );
        const product = mapProduct(result.rows[0]!);
        await appendAudit(
          client,
          context,
          input.laboratoryId,
          'inventory.product.created',
          'Product',
          product.id,
          null,
          product,
        );
        return product;
      });
    } catch (error) {
      if ((error as PgError).code === '23505') {
        throw new ProductConflictError();
      }
      throw error;
    }
  }

  public async listProducts(query: ListProductsQuery): Promise<ProductPage> {
    const limit = Number(query.limit ?? 25);

    const searchPattern = query.search ? `%${query.search.replace(/[\\%_]/g, '\\$&')}%` : null;
    const result = await this.pool.query<ProductRow>(
      `SELECT id, laboratory_id, code, name, cas_number, category, unit_of_measure,
              minimum_stock_threshold, description, created_at, updated_at, archived_at
         FROM products
        WHERE laboratory_id = $1
          AND archived_at IS NULL
          AND ($2::text IS NULL OR category = $2)
          AND ($3::text IS NULL OR name ILIKE $3 ESCAPE '\\' OR code ILIKE $3 ESCAPE '\\' OR cas_number ILIKE $3 ESCAPE '\\')
        ORDER BY lower(name) ASC, id ASC
        LIMIT $4`,
      [query.laboratoryId, query.category ?? null, searchPattern, limit + 1],
    );

    const hasNextPage = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(mapProduct);
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  public async createBatchEntry(
    input: CreateBatchInput,
    context: InventoryMutationContext,
  ): Promise<Batch> {
    return await inTransaction(this.pool, async (client) => {
      const prodResult = await client.query<ProductRow>(
        `SELECT id FROM products WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL`,
        [input.productId, input.laboratoryId],
      );
      if (!prodResult.rows[0]) {
        throw new ProductNotFoundError(input.productId);
      }

      const batchId = crypto.randomUUID();
      const qrCode = `ARQ-LOT-${batchId}`;

      const batchResult = await client.query<BatchRow>(
        `INSERT INTO batches (
           id, laboratory_id, product_id, batch_number, manufacturer, expiration_date,
           received_date, space_option_id, bench_option_id, initial_quantity, qr_code, status, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'AVAILABLE', $12)
         RETURNING id, laboratory_id, product_id, batch_number, manufacturer, expiration_date, received_date, space_option_id, bench_option_id, initial_quantity, qr_code, status, notes, created_at, updated_at, archived_at`,
        [
          batchId,
          input.laboratoryId,
          input.productId,
          input.batchNumber,
          input.manufacturer ?? null,
          input.expirationDate ?? null,
          input.receivedDate ?? new Date().toISOString(),
          input.spaceOptionId ?? null,
          input.benchOptionId ?? null,
          input.initialQuantity,
          qrCode,
          input.notes ?? null,
        ],
      );
      const batchRow = batchResult.rows[0]!;

      // Create initial ENTRY movement
      await client.query(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, movement_type, quantity, balance_after, purpose
         ) VALUES ($1, $2, $3, $4, 'ENTRY', $5, $5, 'Recebimento inicial de lote')`,
        [
          input.laboratoryId,
          batchId,
          input.productId,
          context.actorId,
          input.initialQuantity,
        ],
      );

      const batch = mapBatch(batchRow, Number(input.initialQuantity));
      await appendAudit(
        client,
        context,
        input.laboratoryId,
        'inventory.batch.created',
        'Batch',
        batch.id,
        null,
        batch,
      );

      return batch;
    });
  }

  public async listBatches(query: ListBatchesQuery): Promise<BatchPage> {
    const limit = Number(query.limit ?? 25);

    const searchPattern = query.search ? `%${query.search.replace(/[\\%_]/g, '\\$&')}%` : null;
    const result = await this.pool.query<BatchRow & { current_balance: string | number }>(
      `SELECT b.id, b.laboratory_id, b.product_id, b.batch_number, b.manufacturer,
              b.expiration_date, b.received_date, b.space_option_id, b.bench_option_id,
              b.initial_quantity, b.qr_code, b.status, b.notes, b.created_at, b.updated_at, b.archived_at,
              COALESCE(
                SUM(
                  CASE
                    WHEN sm.movement_type = 'ENTRY' THEN sm.quantity
                    WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity
                    ELSE 0
                  END
                ), 0
              ) AS current_balance
         FROM batches b
    LEFT JOIN stock_movements sm ON sm.batch_id = b.id
        WHERE b.laboratory_id = $1
          AND b.archived_at IS NULL
          AND ($2::uuid IS NULL OR b.product_id = $2)
          AND ($3::uuid IS NULL OR b.space_option_id = $3)
          AND ($4::text IS NULL OR b.status = $4)
          AND ($5::text IS NULL OR b.batch_number ILIKE $5 ESCAPE '\\' OR b.qr_code ILIKE $5 ESCAPE '\\')
        GROUP BY b.id
        ORDER BY b.received_date DESC, b.id ASC
        LIMIT $6`,
      [
        query.laboratoryId,
        query.productId ?? null,
        query.spaceOptionId ?? null,
        query.status ?? null,
        searchPattern,
        limit + 1,
      ],
    );

    const hasNextPage = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map((row) => mapBatch(row, Number(row.current_balance)));
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  public async findBatchById(batchId: string): Promise<Batch | null> {
    const result = await this.pool.query<BatchRow>(
      `SELECT id, laboratory_id, product_id, batch_number, manufacturer, expiration_date,
              received_date, space_option_id, bench_option_id, initial_quantity, qr_code, status, notes,
              created_at, updated_at, archived_at
         FROM batches
        WHERE id = $1 AND archived_at IS NULL`,
      [batchId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const balance = await calculateBatchBalance(this.pool, batchId);
    return mapBatch(row, balance);
  }

  public async findBatchByQrCode(qrCode: string): Promise<Batch | null> {
    const result = await this.pool.query<BatchRow>(
      `SELECT id, laboratory_id, product_id, batch_number, manufacturer, expiration_date,
              received_date, space_option_id, bench_option_id, initial_quantity, qr_code, status, notes,
              created_at, updated_at, archived_at
         FROM batches
        WHERE qr_code = $1 AND archived_at IS NULL`,
      [qrCode],
    );
    const row = result.rows[0];
    if (!row) return null;

    const balance = await calculateBatchBalance(this.pool, row.id);
    return mapBatch(row, balance);
  }

  public async withdrawStock(
    input: WithdrawStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement> {
    const quantity = Number(input.quantity);

    return await inTransaction(this.pool, async (client) => {
      const batchResult = await client.query<BatchRow>(
        `SELECT id, laboratory_id, product_id, batch_number, status FROM batches
          WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL FOR UPDATE`,
        [input.batchId, input.laboratoryId],
      );
      const batchRow = batchResult.rows[0];
      if (!batchRow) {
        throw new BatchNotFoundError(input.batchId);
      }

      const currentBalance = await calculateBatchBalance(client, input.batchId);
      if (currentBalance < quantity) {
        throw new InsufficientStockError(quantity, currentBalance);
      }

      const newBalance = currentBalance - quantity;

      if (newBalance === 0) {
        await client.query(
          `UPDATE batches SET status = 'EXHAUSTED', updated_at = now() WHERE id = $1`,
          [input.batchId],
        );
      }

      const movResult = await client.query<StockMovementRow>(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, project_id, movement_type,
           quantity, balance_after, purpose, reason
         ) VALUES ($1, $2, $3, $4, $5, 'WITHDRAWAL', $6, $7, $8, $9)
         RETURNING id, laboratory_id, batch_id, product_id, user_id, project_id, movement_type, quantity, balance_after, purpose, reason, performed_at, created_at`,
        [
          input.laboratoryId,
          input.batchId,
          batchRow.product_id,
          context.actorId,
          input.projectId,
          quantity,
          newBalance,
          input.purpose,
          input.notes ?? null,
        ],
      );
      const movement = mapMovement(movResult.rows[0]!);

      await appendAudit(
        client,
        context,
        input.laboratoryId,
        'inventory.stock.withdrawn',
        'StockMovement',
        movement.id,
        null,
        movement,
      );

      return movement;
    });
  }

  public async adjustStock(
    input: AdjustStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement> {
    const newBalance = Number(input.newBalance);

    return await inTransaction(this.pool, async (client) => {
      const batchResult = await client.query<BatchRow>(
        `SELECT id, laboratory_id, product_id FROM batches
          WHERE id = $1 AND laboratory_id = $2 AND archived_at IS NULL FOR UPDATE`,
        [input.batchId, input.laboratoryId],
      );
      const batchRow = batchResult.rows[0];
      if (!batchRow) {
        throw new BatchNotFoundError(input.batchId);
      }

      const currentBalance = await calculateBatchBalance(client, input.batchId);
      const delta = newBalance - currentBalance;

      const movResult = await client.query<StockMovementRow>(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, movement_type,
           quantity, balance_after, reason
         ) VALUES ($1, $2, $3, $4, 'ADJUSTMENT', $5, $6, $7)
         RETURNING id, laboratory_id, batch_id, product_id, user_id, project_id, movement_type, quantity, balance_after, purpose, reason, performed_at, created_at`,
        [
          input.laboratoryId,
          input.batchId,
          batchRow.product_id,
          context.actorId,
          delta,
          newBalance,
          input.reason,
        ],
      );

      if (newBalance === 0) {
        await client.query(
          `UPDATE batches SET status = 'EXHAUSTED', updated_at = now() WHERE id = $1`,
          [input.batchId],
        );
      } else {
        await client.query(
          `UPDATE batches SET status = 'AVAILABLE', updated_at = now() WHERE id = $1 AND status = 'EXHAUSTED'`,
          [input.batchId],
        );
      }

      const movement = mapMovement(movResult.rows[0]!);

      await appendAudit(
        client,
        context,
        input.laboratoryId,
        'inventory.stock.adjusted',
        'StockMovement',
        movement.id,
        null,
        movement,
      );

      return movement;
    });
  }

  public async listMovements(
    query: ListStockMovementsQuery,
  ): Promise<StockMovementPage> {
    const limit = Number(query.limit ?? 25);

    const result = await this.pool.query<StockMovementRow>(
      `SELECT id, laboratory_id, batch_id, product_id, user_id, project_id,
              movement_type, quantity, balance_after, purpose, reason, performed_at, created_at
         FROM stock_movements
        WHERE laboratory_id = $1
          AND ($2::uuid IS NULL OR batch_id = $2)
          AND ($3::uuid IS NULL OR product_id = $3)
          AND ($4::uuid IS NULL OR project_id = $4)
          AND ($5::text IS NULL OR movement_type = $5)
        ORDER BY performed_at DESC, id DESC
        LIMIT $6`,
      [
        query.laboratoryId,
        query.batchId ?? null,
        query.productId ?? null,
        query.projectId ?? null,
        query.type ?? null,
        limit + 1,
      ],
    );

    const hasNextPage = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(mapMovement);
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      },
    };
  }
}
