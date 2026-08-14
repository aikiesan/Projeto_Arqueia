import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { GetAuditLogDetailUseCase } from './application/get-audit-log-detail.use-case.js';
import { GetDashboardSummaryUseCase } from './application/get-dashboard-summary.use-case.js';
import { GetManagementAnalyticsUseCase } from './application/get-management-analytics.use-case.js';
import { GetProjectUsageUseCase } from './application/get-project-usage.use-case.js';
import { ListAuditLogsUseCase } from './application/list-audit-logs.use-case.js';
import {
  MANAGEMENT_REPOSITORY,
  type ManagementRepository,
} from './domain/ports/management-repository.port.js';
import { PostgresManagementRepository } from './infrastructure/postgres-management-repository.js';
import { ManagementController } from './interface/management.controller.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [ManagementController],
  providers: [
    {
      provide: MANAGEMENT_REPOSITORY,
      useFactory: (pool: DatabasePool): ManagementRepository =>
        new PostgresManagementRepository(pool),
      inject: [DATABASE_POOL],
    },
    {
      provide: GetDashboardSummaryUseCase,
      useFactory: (repo: ManagementRepository, perms: PermissionEvaluator) =>
        new GetDashboardSummaryUseCase(repo, perms),
      inject: [MANAGEMENT_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: GetManagementAnalyticsUseCase,
      useFactory: (repo: ManagementRepository, perms: PermissionEvaluator) =>
        new GetManagementAnalyticsUseCase(repo, perms),
      inject: [MANAGEMENT_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: GetProjectUsageUseCase,
      useFactory: (repo: ManagementRepository, perms: PermissionEvaluator) =>
        new GetProjectUsageUseCase(repo, perms),
      inject: [MANAGEMENT_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: ListAuditLogsUseCase,
      useFactory: (repo: ManagementRepository, perms: PermissionEvaluator) =>
        new ListAuditLogsUseCase(repo, perms),
      inject: [MANAGEMENT_REPOSITORY, PermissionEvaluator],
    },
    {
      provide: GetAuditLogDetailUseCase,
      useFactory: (repo: ManagementRepository, perms: PermissionEvaluator) =>
        new GetAuditLogDetailUseCase(repo, perms),
      inject: [MANAGEMENT_REPOSITORY, PermissionEvaluator],
    },
  ],
  exports: [MANAGEMENT_REPOSITORY],
})
export class ManagementModule {}
