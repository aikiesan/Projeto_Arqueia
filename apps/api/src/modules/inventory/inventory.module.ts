import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { AdjustStockUseCase } from './application/adjust-stock.use-case.js';
import { CreateBatchEntryUseCase } from './application/create-batch-entry.use-case.js';
import { CreateProductUseCase } from './application/create-product.use-case.js';
import { ListBatchesUseCase } from './application/list-batches.use-case.js';
import { ListProductsUseCase } from './application/list-products.use-case.js';
import { ListStockMovementsUseCase } from './application/list-stock-movements.use-case.js';
import { WithdrawStockUseCase } from './application/withdraw-stock.use-case.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from './domain/ports/inventory-repository.port.js';
import { PostgresInventoryRepository } from './infrastructure/postgres-inventory-repository.js';
import { InventoryController } from './interface/inventory.controller.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [InventoryController],
  providers: [
    {
      provide: INVENTORY_REPOSITORY,
      useFactory: (pool: DatabasePool): InventoryRepository =>
        new PostgresInventoryRepository(pool),
      inject: [DATABASE_POOL],
    },
    {
      provide: CreateProductUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new CreateProductUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: ListProductsUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new ListProductsUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: CreateBatchEntryUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new CreateBatchEntryUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: ListBatchesUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new ListBatchesUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: WithdrawStockUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new WithdrawStockUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: AdjustStockUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new AdjustStockUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: ListStockMovementsUseCase,
      useFactory: (repo: InventoryRepository, evalPerms: PermissionEvaluator) =>
        new ListStockMovementsUseCase(repo, evalPerms),
      inject: [INVENTORY_REPOSITORY, PermissionEvaluator],
    },
  ],
  exports: [INVENTORY_REPOSITORY],
})
export class InventoryModule {}
