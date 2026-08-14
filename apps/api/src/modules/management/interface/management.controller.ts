import {
  listAuditLogsQuerySchema,
  managementAnalyticsQuerySchema,
  projectUsageQuerySchema,
  uuidSchema,
  type AuditLogDetail,
  type AuditLogPage,
  type AuthenticatedPrincipal,
  type DashboardSummary,
  type ListAuditLogsQuery,
  type ManagementAnalytics,
  type ManagementAnalyticsQuery,
  type ProjectUsagePage,
  type ProjectUsageQuery,
} from '@arqueia/contracts';
import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { ManagementExceptionFilter } from './management-exception.filter.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { GetAuditLogDetailUseCase } from '../application/get-audit-log-detail.use-case.js';
import { GetDashboardSummaryUseCase } from '../application/get-dashboard-summary.use-case.js';
import { GetManagementAnalyticsUseCase } from '../application/get-management-analytics.use-case.js';
import { GetProjectUsageUseCase } from '../application/get-project-usage.use-case.js';
import { ListAuditLogsUseCase } from '../application/list-audit-logs.use-case.js';

@Controller('api/management')
@UseGuards(JwtAuthGuard)
@UseFilters(ManagementExceptionFilter)
export class ManagementController {
  public constructor(
    @Inject(GetDashboardSummaryUseCase)
    private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
    @Inject(GetManagementAnalyticsUseCase)
    private readonly getAnalyticsUseCase: GetManagementAnalyticsUseCase,
    @Inject(GetProjectUsageUseCase)
    private readonly getProjectUsageUseCase: GetProjectUsageUseCase,
    @Inject(ListAuditLogsUseCase)
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    @Inject(GetAuditLogDetailUseCase)
    private readonly getAuditLogDetailUseCase: GetAuditLogDetailUseCase,
  ) {}

  @Get('dashboard')
  public getDashboardSummary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('laboratoryId') laboratoryId: string,
  ): Promise<DashboardSummary> {
    return this.getDashboardSummaryUseCase.execute(principal, uuidSchema.parse(laboratoryId));
  }

  @Get('analytics')
  public getAnalytics(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<ManagementAnalytics> {
    const parsed = managementAnalyticsQuerySchema.parse(query) as ManagementAnalyticsQuery;
    return this.getAnalyticsUseCase.execute(principal, parsed);
  }

  @Get('project-usage')
  public getProjectUsage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<ProjectUsagePage> {
    const parsed = projectUsageQuerySchema.parse(query) as ProjectUsageQuery;
    return this.getProjectUsageUseCase.execute(principal, parsed);
  }

  @Get('audit-logs')
  public listAuditLogs(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<AuditLogPage> {
    const parsed = listAuditLogsQuerySchema.parse(query) as ListAuditLogsQuery;
    return this.listAuditLogsUseCase.execute(principal, parsed);
  }

  @Get('audit-logs/:auditEventId')
  public getAuditLogDetail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('auditEventId') auditEventId: string,
    @Query('laboratoryId') laboratoryId: string,
  ): Promise<AuditLogDetail> {
    const validEventId = uuidSchema.parse(auditEventId);
    const validLabId = uuidSchema.parse(laboratoryId);
    return this.getAuditLogDetailUseCase.execute(principal, validEventId, validLabId);
  }
}
