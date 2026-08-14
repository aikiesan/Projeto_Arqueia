import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { ListCatalogOptionsUseCase } from './application/list-catalog-options.use-case.js';
import {
  CATALOG_ACCESS_POLICY,
  type CatalogAccessPolicy,
} from './domain/ports/catalog-access-policy.port.js';
import {
  CATALOG_OPTION_READER,
  type CatalogOptionReader,
} from './domain/ports/catalog-option-reader.port.js';
import { IdentityCatalogAccessPolicy } from './infrastructure/identity-catalog-access-policy.js';
import { PostgresCatalogOptionReader } from './infrastructure/postgres-catalog-option-reader.js';
import { CatalogOptionsController } from './interface/catalog-options.controller.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [CatalogOptionsController],
  providers: [
    {
      provide: CATALOG_OPTION_READER,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresCatalogOptionReader(pool),
    },
    {
      provide: CATALOG_ACCESS_POLICY,
      inject: [PermissionEvaluator],
      useFactory: (permissions: PermissionEvaluator) =>
        new IdentityCatalogAccessPolicy(permissions),
    },
    {
      provide: ListCatalogOptionsUseCase,
      inject: [CATALOG_OPTION_READER, CATALOG_ACCESS_POLICY],
      useFactory: (reader: CatalogOptionReader, policy: CatalogAccessPolicy) =>
        new ListCatalogOptionsUseCase(reader, policy),
    },
  ],
})
export class CatalogModule {}
