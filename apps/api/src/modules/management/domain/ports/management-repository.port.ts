import type {
  AuditLogDetail,
  AuditLogPage,
  ListAuditLogsQuery,
  ManagementAnalytics,
  ManagementAnalyticsQuery,
  ProjectUsagePage,
  ProjectUsageQuery,
} from '@arqueia/contracts';

export interface ManagementRepository {
  getAnalytics(query: ManagementAnalyticsQuery): Promise<ManagementAnalytics>;
  getProjectUsage(query: ProjectUsageQuery): Promise<ProjectUsagePage>;
  listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage>;
  getAuditLogDetail(
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail | null>;
}

export const MANAGEMENT_REPOSITORY = Symbol('MANAGEMENT_REPOSITORY');
