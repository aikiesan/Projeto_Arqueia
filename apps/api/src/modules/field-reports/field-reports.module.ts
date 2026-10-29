import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import {
  MAIL_SENDER,
  MailerModule,
  type MailSender,
} from '../../shared/infrastructure/mailer.module.js';
import { loadApiEnvironment } from '../../configuration.js';
import {
  AUDIT_EVENT_WRITER,
  type AuditEventWriter,
} from '../identity/domain/ports/audit-event-writer.port.js';
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
import {
  FIELD_REPORT_ALERT_RECIPIENT_READER,
  URGENT_FIELD_REPORT_NOTIFIER,
  type FieldReportAlertRecipientReader,
  type UrgentFieldReportNotifier,
} from './domain/ports/urgent-field-report-alert.port.js';
import { MailUrgentFieldReportNotifier } from './infrastructure/mail-urgent-field-report-notifier.js';
import { PostgresFieldReportAlertRecipientReader } from './infrastructure/postgres-field-report-alert-recipient-reader.js';
import { PostgresFieldReportRepository } from './infrastructure/postgres-field-report-repository.js';
import { FieldReportController } from './interface/field-report.controller.js';
import {
  FIELD_REPORT_RATE_LIMIT,
  FIELD_REPORT_RATE_LIMITER,
  FieldReportRateLimitGuard,
} from './interface/field-report-rate-limit.guard.js';
import { PublicFieldReportController } from './interface/public-field-report.controller.js';

@Module({
  imports: [DatabaseModule, MailerModule, IdentityModule],
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
      provide: FIELD_REPORT_ALERT_RECIPIENT_READER,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresFieldReportAlertRecipientReader(pool),
    },
    {
      provide: URGENT_FIELD_REPORT_NOTIFIER,
      inject: [MAIL_SENDER],
      useFactory: (mail: MailSender) => new MailUrgentFieldReportNotifier(mail),
    },
    {
      provide: SubmitFieldReportUseCase,
      inject: [
        PUBLIC_FIELD_REPORT_GATEWAY,
        FIELD_REPORT_ALERT_RECIPIENT_READER,
        URGENT_FIELD_REPORT_NOTIFIER,
        AUDIT_EVENT_WRITER,
      ],
      useFactory: (
        gateway: PublicFieldReportGateway,
        recipients: FieldReportAlertRecipientReader,
        notifier: UrgentFieldReportNotifier,
        auditEvents: AuditEventWriter,
      ) => {
        const environment = loadApiEnvironment();
        return new SubmitFieldReportUseCase(gateway, recipients, notifier, auditEvents, {
          publicOrigin: environment.PUBLIC_ORIGIN,
          basePath: environment.NEXT_PUBLIC_BASE_PATH,
        });
      },
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
