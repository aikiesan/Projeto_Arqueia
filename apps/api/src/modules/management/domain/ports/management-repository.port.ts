import type {
  AuditLogDetail,
  AuditLogPage,
  DashboardSummary,
  ListAuditLogsQuery,
  ManagementAnalytics,
  ManagementAnalyticsQuery,
  ProjectUsagePage,
  ProjectUsageQuery,
} from '@arqueia/contracts';

export interface ManagementRepository {
  getDashboardSummary(laboratoryId: string): Promise<DashboardSummary>;
  getAnalytics(query: ManagementAnalyticsQuery): Promise<ManagementAnalytics>;
  getProjectUsage(query: ProjectUsageQuery): Promise<ProjectUsagePage>;
  listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage>;
  getAuditLogDetail(
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail | null>;
}

export const MANAGEMENT_REPOSITORY = Symbol('MANAGEMENT_REPOSITORY');
