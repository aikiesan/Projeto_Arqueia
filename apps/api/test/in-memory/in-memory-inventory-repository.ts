import { randomUUID } from 'node:crypto';

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

import {
  BatchNotFoundError,
  InsufficientStockError,
  ProductConflictError,
  ProductNotFoundError,
} from '../../src/modules/inventory/domain/inventory.errors.js';
import type {
  InventoryMutationContext,
  InventoryRepository,
} from '../../src/modules/inventory/domain/ports/inventory-repository.port.js';

export class InMemoryInventoryRepository implements InventoryRepository {
  public readonly products = new Map<string, Product>();
  public readonly batches = new Map<string, Batch>();
  public readonly movements: StockMovement[] = [];

  private calculateBatchBalance(batchId: string): number {
    const batchMovements = this.movements.filter((m) => m.batchId === batchId);
    if (batchMovements.length === 0) return 0;
    return batchMovements[batchMovements.length - 1]!.balanceAfter;
  }

  public async createProduct(
    input: CreateProductInput,
    _context: InventoryMutationContext,
  ): Promise<Product> {
    const duplicate = Array.from(this.products.values()).find(
      (p) =>
        p.laboratoryId === input.laboratoryId &&
        p.code.toLowerCase() === input.code.toLowerCase() &&
        p.archivedAt === null,
    );
    if (duplicate) {
      throw new ProductConflictError();
    }

    const now = new Date().toISOString();
    const product = productSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      code: input.code,
      name: input.name,
      casNumber: input.casNumber ?? null,
      category: input.category,
      unitOfMeasure: input.unitOfMeasure,
      minimumStockThreshold: input.minimumStockThreshold ?? 0,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.products.set(product.id, product);
    return product;
  }

  public async listProducts(query: ListProductsQuery): Promise<ProductPage> {
    let items = Array.from(this.products.values()).filter(
      (p) => p.laboratoryId === query.laboratoryId && p.archivedAt === null,
    );

    if (query.category) {
      items = items.filter((p) => p.category === query.category);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.code.toLowerCase().includes(s) ||
          (p.casNumber && p.casNumber.toLowerCase().includes(s)),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    const limit = query.limit ?? 25;
    const paginated = items.slice(0, limit);
    return {
      items: paginated,
      pageInfo: {
        hasNextPage: items.length > limit,
        nextCursor: items.length > limit ? paginated[paginated.length - 1]!.id : null,
      },
    };
  }

  public async createBatchEntry(
    input: CreateBatchInput,
    context: InventoryMutationContext,
  ): Promise<Batch> {
    const product = this.products.get(input.productId);
    if (!product || product.laboratoryId !== input.laboratoryId || product.archivedAt !== null) {
      throw new ProductNotFoundError(input.productId);
    }

    const qrConflict = Array.from(this.batches.values()).find(
      (b) => b.qrCode === input.qrCode && b.archivedAt === null,
    );
    if (qrConflict) {
      throw new Error(`Código QR ${input.qrCode} já está em uso por outro lote ativo.`);
    }

    const now = new Date().toISOString();
    const batchId = randomUUID();

    const batch = batchSchema.parse({
      id: batchId,
      laboratoryId: input.laboratoryId,
      productId: input.productId,
      batchNumber: input.batchNumber,
      manufacturer: input.manufacturer ?? null,
      expirationDate: input.expirationDate ?? null,
      receivedDate: input.receivedDate ?? now,
      spaceOptionId: input.spaceOptionId ?? null,
      benchOptionId: input.benchOptionId ?? null,
      initialQuantity: input.initialQuantity,
      currentBalance: input.initialQuantity,
      qrCode: input.qrCode,
      status: 'AVAILABLE',
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.batches.set(batchId, batch);

    const movement = stockMovementSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      batchId,
      productId: input.productId,
      userId: context.actorId,
      projectId: null,
      type: 'ENTRY',
      quantity: input.initialQuantity,
      balanceAfter: input.initialQuantity,
      purpose: 'Entrada de lote',
      reason: null,
      performedAt: now,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.movements.push(movement);
    return batch;
  }

  public async listBatches(query: ListBatchesQuery): Promise<BatchPage> {
    let items = Array.from(this.batches.values()).filter(
      (b) => b.laboratoryId === query.laboratoryId && b.archivedAt === null,
    );

    if (query.productId) {
      items = items.filter((b) => b.productId === query.productId);
    }
    if (query.status) {
      items = items.filter((b) => b.status === query.status);
    }

    // Attach computed dynamic balances
    items = items.map((b) => ({
      ...b,
      currentBalance: this.calculateBatchBalance(b.id),
    }));

    const limit = query.limit ?? 25;
    const paginated = items.slice(0, limit);
    return {
      items: paginated,
      pageInfo: {
        hasNextPage: items.length > limit,
        nextCursor: items.length > limit ? paginated[paginated.length - 1]!.id : null,
      },
    };
  }

  public async findBatchById(batchId: string): Promise<Batch | null> {
    const batch = this.batches.get(batchId);
    if (!batch || batch.archivedAt !== null) return null;
    return {
      ...batch,
      currentBalance: this.calculateBatchBalance(batchId),
    };
  }

  public async findBatchByQrCode(qrCode: string): Promise<Batch | null> {
    const batch = Array.from(this.batches.values()).find(
      (b) => b.qrCode === qrCode && b.archivedAt === null,
    );
    if (!batch) return null;
    return {
      ...batch,
      currentBalance: this.calculateBatchBalance(batch.id),
    };
  }

  public async withdrawStock(
    input: WithdrawStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement> {
    const batch = this.batches.get(input.batchId);
    if (!batch || batch.laboratoryId !== input.laboratoryId || batch.archivedAt !== null) {
      throw new BatchNotFoundError(input.batchId);
    }

    if (batch.status === 'EXHAUSTED' || batch.status === 'DISCARDED') {
      throw new Error(`Lote indisponível para retirada (status: ${batch.status}).`);
    }

    const currentBalance = this.calculateBatchBalance(input.batchId);
    if (input.quantity > currentBalance) {
      throw new InsufficientStockError(input.quantity, currentBalance);
    }

    const newBalance = currentBalance - input.quantity;
    const now = new Date().toISOString();

    const movement = stockMovementSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      batchId: input.batchId,
      productId: batch.productId,
      userId: context.actorId,
      projectId: input.projectId,
      type: 'WITHDRAWAL',
      quantity: -input.quantity,
      balanceAfter: newBalance,
      purpose: input.purpose,
      reason: null,
      performedAt: now,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.movements.push(movement);

    if (newBalance === 0) {
      this.batches.set(batch.id, {
        ...batch,
        status: 'EXHAUSTED',
        currentBalance: 0,
        updatedAt: now,
      });
    }

    return movement;
  }

  public async adjustStock(
    input: AdjustStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement> {
    const batch = this.batches.get(input.batchId);
    if (!batch || batch.laboratoryId !== input.laboratoryId || batch.archivedAt !== null) {
      throw new BatchNotFoundError(input.batchId);
    }

    const currentBalance = this.calculateBatchBalance(input.batchId);
    const delta = input.newBalance - currentBalance;
    const now = new Date().toISOString();

    const movement = stockMovementSchema.parse({
      id: randomUUID(),
      laboratoryId: input.laboratoryId,
      batchId: input.batchId,
      productId: batch.productId,
      userId: context.actorId,
      projectId: null,
      type: 'ADJUSTMENT',
      quantity: delta,
      balanceAfter: input.newBalance,
      purpose: null,
      reason: input.reason,
      performedAt: now,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    this.movements.push(movement);

    this.batches.set(batch.id, {
      ...batch,
      status: input.newBalance === 0 ? 'EXHAUSTED' : 'AVAILABLE',
      currentBalance: input.newBalance,
      updatedAt: now,
    });

    return movement;
  }

  public async listMovements(query: ListStockMovementsQuery): Promise<StockMovementPage> {
    let items = this.movements.filter(
      (m) => m.laboratoryId === query.laboratoryId && m.archivedAt === null,
    );

    if (query.batchId) {
      items = items.filter((m) => m.batchId === query.batchId);
    }
    if (query.productId) {
      items = items.filter((m) => m.productId === query.productId);
    }
    if (query.type) {
      items = items.filter((m) => m.type === query.type);
    }

    items.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

    const limit = query.limit ?? 25;
    const paginated = items.slice(0, limit);
    return {
      items: paginated,
      pageInfo: {
        hasNextPage: items.length > limit,
        nextCursor: items.length > limit ? paginated[paginated.length - 1]!.id : null,
      },
    };
  }
}
