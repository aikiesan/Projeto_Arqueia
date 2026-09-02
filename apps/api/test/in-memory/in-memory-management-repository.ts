import { randomUUID } from 'node:crypto';

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

import type {
  DashboardSectionAccess,
  ManagementRepository,
} from '../../src/modules/management/domain/ports/management-repository.port.js';

export interface StoredAuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly laboratoryId: string | null;
  readonly origin: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly redactedFields: readonly string[];
}

export class InMemoryManagementRepository implements ManagementRepository {
  public readonly auditEvents: StoredAuditEvent[] = [];

  public async getDashboardSummary(
    laboratoryId: string,
    access: DashboardSectionAccess,
  ): Promise<DashboardSummary> {
    const now = new Date().toISOString();
    return {
      laboratoryId,
      timezone: 'America/Sao_Paulo',
      equipmentSummary: access.equipment
        ? {
            total: 12,
            byStatus: {
              AVAILABLE: 10,
              UNDER_EVALUATION: 1,
              UNAVAILABLE: 0,
              MAINTENANCE: 1,
            },
          }
        : {
            total: 0,
            byStatus: {
              AVAILABLE: 0,
              UNDER_EVALUATION: 0,
              UNAVAILABLE: 0,
              MAINTENANCE: 0,
            },
          },
      todayReservations: access.scheduling ? [] : [],
      upcomingActions: [],
      inventoryAlerts: access.inventory
        ? [
            {
              kind: 'LOW_STOCK' as const,
              productId: randomUUID(),
              productName: 'Citrato Férrico Amoniacal P.A.',
              batchId: randomUUID(),
              batchNumber: 'SIGMA-CF-2019',
              detail: 'Estoque abaixo do limite mínimo (1 / 2 FRASCO)',
              href: '/estoque',
            },
          ]
        : [],
      quickActions: [
        ...(access.scheduling ? [{ id: 'scheduling' as const, label: 'Agendar Equipamento', route: '/agenda' }] : []),
        ...(access.inventory ? [{ id: 'inventory' as const, label: 'Retirar do Estoque', route: '/estoque' }] : []),
        ...(access.equipment ? [{ id: 'equipment' as const, label: 'Equipamentos', route: '/equipamentos' }] : []),
      ],
      availability: {
        equipment: access.equipment,
        scheduling: access.scheduling,
        inventory: access.inventory,
        maintenance: access.maintenance,
        pendingActions: false,
      },
      generatedAt: now,
    };
  }

  public async getAnalytics(query: ManagementAnalyticsQuery): Promise<ManagementAnalytics> {
    return {
      laboratoryId: query.laboratoryId,
      timezone: 'America/Sao_Paulo',
      period: {
        startsAt: query.startsAt,
        endsAt: query.endsAt,
      },
      equipmentMetrics: {
        totalActiveEquipment: 12,
        totalReservedHours: 84.0,
        reservationCount: 22,
      },
      inventoryMetrics: {
        totalActiveBatches: 8,
        lowStockProductsCount: 1,
        expiringBatchesCount: 0,
        totalWithdrawalsCount: 15,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  public async getProjectUsage(query: ProjectUsageQuery): Promise<ProjectUsagePage> {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
    };
  }

  public async listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage> {
    let items = this.auditEvents.filter((e) => e.laboratoryId === query.laboratoryId);

    if (query.action) {
      items = items.filter((e) => e.action === query.action);
    }
    if (query.entity) {
      items = items.filter((e) => e.entity === query.entity);
    }
    if (query.startsAt) {
      const start = new Date(query.startsAt).getTime();
      items = items.filter((e) => new Date(e.occurredAt).getTime() >= start);
    }
    if (query.endsAt) {
      const end = new Date(query.endsAt).getTime();
      items = items.filter((e) => new Date(e.occurredAt).getTime() <= end);
    }

    items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    const limit = query.limit ?? 25;
    const paginated = items.slice(0, limit).map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      actorId: e.actorId,
      actorName: e.actorName,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      laboratoryId: e.laboratoryId,
      origin: e.origin,
    }));

    return {
      items: paginated,
      pageInfo: {
        hasNextPage: items.length > limit,
        nextCursor: items.length > limit ? paginated[paginated.length - 1]!.id : null,
      },
    };
  }

  public async getAuditLogDetail(
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail | null> {
    const event = this.auditEvents.find(
      (e) => e.id === auditEventId && e.laboratoryId === laboratoryId,
    );
    if (!event) return null;

    return {
      id: event.id,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      actorName: event.actorName,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      laboratoryId: event.laboratoryId,
      origin: event.origin,
      before: event.before,
      after: event.after,
      redactedFields: event.redactedFields,
    };
  }
}
