import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PermissionEvaluator } from '../identity/domain/services/permission-evaluator.js';
import { AuthRateLimiterService } from '../identity/infrastructure/auth-rate-limiter.service.js';
import { GetPublicFieldReportFormUseCase } from './application/get-public-field-report-form.use-case.js';
import { ListFieldReportsUseCase } from './application/list-field-reports.use-case.js';
import { ReviewFieldReportUseCase } from './application/review-field-report.use-case.js';
import { SubmitFieldReportUseCase } from './application/submit-field-report.use-case.js';
import { SummarizeFieldReportsUseCase } from './application/summarize-field-reports.use-case.js';
import {
  FIELD_REPORT_REVIEW_REPOSITORY,
  PUBLIC_FIELD_REPORT_GATEWAY,
  type FieldReportReviewRepository,
  type PublicFieldReportGateway,
} from './domain/ports/field-report-repository.port.js';
import { PostgresFieldReportRepository } from './infrastructure/postgres-field-report-repository.js';
import { FieldReportController } from './interface/field-report.controller.js';
import {
  FIELD_REPORT_RATE_LIMIT,
  FIELD_REPORT_RATE_LIMITER,
  FieldReportRateLimitGuard,
} from './interface/field-report-rate-limit.guard.js';
import { PublicFieldReportController } from './interface/public-field-report.controller.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [PublicFieldReportController, FieldReportController],
  providers: [
    {
      provide: PostgresFieldReportRepository,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresFieldReportRepository(pool),
    },
    { provide: PUBLIC_FIELD_REPORT_GATEWAY, useExisting: PostgresFieldReportRepository },
    { provide: FIELD_REPORT_REVIEW_REPOSITORY, useExisting: PostgresFieldReportRepository },
    {
      // Instância própria: o balde dos informes não compartilha contagem com o login.
      provide: FIELD_REPORT_RATE_LIMITER,
      useFactory: () =>
        new AuthRateLimiterService(
          FIELD_REPORT_RATE_LIMIT.maxAttempts,
          FIELD_REPORT_RATE_LIMIT.windowSeconds,
        ),
    },
    FieldReportRateLimitGuard,
    {
      provide: GetPublicFieldReportFormUseCase,
      inject: [PUBLIC_FIELD_REPORT_GATEWAY],
      useFactory: (gateway: PublicFieldReportGateway) => new GetPublicFieldReportFormUseCase(gateway),
    },
    {
      provide: SubmitFieldReportUseCase,
      inject: [PUBLIC_FIELD_REPORT_GATEWAY],
      useFactory: (gateway: PublicFieldReportGateway) => new SubmitFieldReportUseCase(gateway),
    },
    {
      provide: ListFieldReportsUseCase,
      inject: [FIELD_REPORT_REVIEW_REPOSITORY, PermissionEvaluator],
      useFactory: (reports: FieldReportReviewRepository, permissions: PermissionEvaluator) =>
        new ListFieldReportsUseCase(reports, permissions),
    },
    {
      provide: SummarizeFieldReportsUseCase,
      inject: [FIELD_REPORT_REVIEW_REPOSITORY, PermissionEvaluator],
      useFactory: (reports: FieldReportReviewRepository, permissions: PermissionEvaluator) =>
        new SummarizeFieldReportsUseCase(reports, permissions),
    },
    {
      provide: ReviewFieldReportUseCase,
      inject: [FIELD_REPORT_REVIEW_REPOSITORY, PermissionEvaluator],
      useFactory: (reports: FieldReportReviewRepository, permissions: PermissionEvaluator) =>
        new ReviewFieldReportUseCase(reports, permissions),
    },
  ],
})
export class FieldReportsModule {}
