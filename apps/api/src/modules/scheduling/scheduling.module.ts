import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { CancelReservationUseCase } from './application/cancel-reservation.use-case.js';
import { CancelTechnicalBlockUseCase } from './application/cancel-technical-block.use-case.js';
import { CreateReservationUseCase } from './application/create-reservation.use-case.js';
import { CreateTechnicalBlockUseCase } from './application/create-technical-block.use-case.js';
import { ListScheduleUseCase } from './application/list-schedule.use-case.js';
import {
  SCHEDULING_REPOSITORY,
  type SchedulingRepository,
} from './domain/ports/scheduling-repository.port.js';
import { PostgresSchedulingRepository } from './infrastructure/postgres-scheduling-repository.js';
import { SchedulingController } from './interface/scheduling.controller.js';


@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [SchedulingController],
  providers: [
    {
      provide: SCHEDULING_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresSchedulingRepository(pool),
    },
    {
      provide: ListScheduleUseCase,
      inject: [SCHEDULING_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: SchedulingRepository, permissions: PermissionEvaluator) =>
        new ListScheduleUseCase(repository, permissions),
    },
    {
      provide: CreateReservationUseCase,
      inject: [SCHEDULING_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: SchedulingRepository, permissions: PermissionEvaluator) =>
        new CreateReservationUseCase(repository, permissions),
    },
    {
      provide: CancelReservationUseCase,
      inject: [SCHEDULING_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: SchedulingRepository, permissions: PermissionEvaluator) =>
        new CancelReservationUseCase(repository, permissions),
    },
    {
      provide: CreateTechnicalBlockUseCase,
      inject: [SCHEDULING_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: SchedulingRepository, permissions: PermissionEvaluator) =>
        new CreateTechnicalBlockUseCase(repository, permissions),
    },
    {
      provide: CancelTechnicalBlockUseCase,
      inject: [SCHEDULING_REPOSITORY, PermissionEvaluator],
      useFactory: (repository: SchedulingRepository, permissions: PermissionEvaluator) =>
        new CancelTechnicalBlockUseCase(repository, permissions),
    },
  ],
  exports: [SCHEDULING_REPOSITORY],
})
export class SchedulingModule {}
