import type {
  AdjustStockInput,
  Batch,
  BatchPage,
  CreateBatchInput,
  CreateProductInput,
  ListBatchesQuery,
  ListProductsQuery,
  ListStockMovementsQuery,
  Product,
  ProductPage,
  StockMovement,
  StockMovementPage,
  WithdrawStockInput,
} from '@arqueia/contracts';

export interface InventoryMutationContext {
  actorId: string;
  origin: string;
  requestId: string | null;
}

export interface InventoryRepository {
  createProduct(
    input: CreateProductInput,
    context: InventoryMutationContext,
  ): Promise<Product>;

  listProducts(query: ListProductsQuery): Promise<ProductPage>;

  createBatchEntry(
    input: CreateBatchInput,
    context: InventoryMutationContext,
  ): Promise<Batch>;

  listBatches(query: ListBatchesQuery): Promise<BatchPage>;

  findBatchById(batchId: string): Promise<Batch | null>;

  findBatchByQrCode(qrCode: string): Promise<Batch | null>;

  withdrawStock(
    input: WithdrawStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement>;

  adjustStock(
    input: AdjustStockInput,
    context: InventoryMutationContext,
  ): Promise<StockMovement>;

  listMovements(query: ListStockMovementsQuery): Promise<StockMovementPage>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
