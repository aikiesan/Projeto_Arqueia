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

export interface DashboardSectionAccess {
  readonly equipment: boolean;
  readonly scheduling: boolean;
  readonly inventory: boolean;
  readonly maintenance: boolean;
}

export interface ManagementRepository {
  getDashboardSummary(
    laboratoryId: string,
    access: DashboardSectionAccess,
  ): Promise<DashboardSummary>;
  getAnalytics(query: ManagementAnalyticsQuery): Promise<ManagementAnalytics>;
  getProjectUsage(query: ProjectUsageQuery): Promise<ProjectUsagePage>;
  listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage>;
  getAuditLogDetail(
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail | null>;
}

export const MANAGEMENT_REPOSITORY = Symbol('MANAGEMENT_REPOSITORY');
