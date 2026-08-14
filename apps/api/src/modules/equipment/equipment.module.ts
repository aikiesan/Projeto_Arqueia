import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { CreateEquipmentUseCase } from './application/create-equipment.use-case.js';
import { ListEquipmentUseCase } from './application/list-equipment.use-case.js';
import { UpdateEquipmentUseCase } from './application/update-equipment.use-case.js';
import {
  EQUIPMENT_REPOSITORY,
  type EquipmentRepository,
} from './domain/ports/equipment-repository.port.js';
import { PostgresEquipmentRepository } from './infrastructure/postgres-equipment-repository.js';
import { EquipmentController } from './interface/equipment.controller.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [EquipmentController],
  providers: [
    {
      provide: EQUIPMENT_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresEquipmentRepository(pool),
    },
    {
      provide: ListEquipmentUseCase,
      inject: [EQUIPMENT_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: EquipmentRepository, permissions: PermissionEvaluator) =>
        new ListEquipmentUseCase(repository, permissions),
    },
    {
      provide: CreateEquipmentUseCase,
      inject: [EQUIPMENT_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: EquipmentRepository, permissions: PermissionEvaluator) =>
        new CreateEquipmentUseCase(repository, permissions),
    },
    {
      provide: UpdateEquipmentUseCase,
      inject: [EQUIPMENT_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: EquipmentRepository, permissions: PermissionEvaluator) =>
        new UpdateEquipmentUseCase(repository, permissions),
    },
  ],
})
export class EquipmentModule {}
