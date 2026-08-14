import {
  auditLogDetailSchema,
  auditLogPageSchema,
  auditLogSummarySchema,
  dashboardSummarySchema,
  decodeAuditCursor,
  encodeAuditCursor,
  managementAnalyticsSchema,
  projectUsagePageSchema,
  type AuditLogDetail,

  type AuditLogPage,
  type DashboardSummary,
  type ListAuditLogsQuery,
  type ManagementAnalytics,
  type ManagementAnalyticsQuery,
  type ProjectUsagePage,
  type ProjectUsageQuery,
  type ProjectUsageSummary,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';
import { createHash } from 'node:crypto';

import type { ManagementRepository } from '../domain/ports/management-repository.port.js';
import type { DashboardSectionAccess } from '../domain/ports/management-repository.port.js';
import { ManagementLaboratoryNotFoundError } from '../domain/management.errors.js';

interface AuditRow {
  id: string;
  occurred_at: Date;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string;
  laboratory_id: string | null;
  origin: string;
  before: unknown;
  after: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'temporarypassword',
  'token',
  'refreshtoken',
  'secret',
  'mfasecret',
  'fileref',
  'authorization',
  'cookie',
]);

const ALLOWED_ENTITY_KEYS: Record<string, Set<string>> = {
  Product: new Set([
    'id',
    'laboratoryId',
    'code',
    'name',
    'casNumber',
    'category',
    'unitOfMeasure',
    'minimumStockThreshold',
    'description',
  ]),
  Batch: new Set([
    'id',
    'laboratoryId',
    'productId',
    'batchNumber',
    'manufacturer',
    'expirationDate',
    'receivedDate',
    'initialQuantity',
    'currentBalance',
    'qrCode',
    'status',
    'notes',
  ]),
  StockMovement: new Set([
    'id',
    'laboratoryId',
    'batchId',
    'productId',
    'userId',
    'projectId',
    'type',
    'quantity',
    'balanceAfter',
    'purpose',
    'reason',
    'performedAt',
  ]),
  Reservation: new Set([
    'id',
    'laboratoryId',
    'equipmentId',
    'userId',
    'projectId',
    'startsAt',
    'endsAt',
    'purpose',
    'sampleCount',
    'status',
  ]),
  TechnicalBlock: new Set([
    'id',
    'laboratoryId',
    'equipmentId',
    'userId',
    'reason',
    'description',
    'startsAt',
    'endsAt',
    'status',
  ]),
  Equipment: new Set([
    'id',
    'laboratoryId',
    'code',
    'name',
    'status',
    'reservationPolicy',
  ]),
  User: new Set([
    'id',
    'institutionId',
    'name',
    'email',
    'status',
    'identityProvider',
  ]),
  Membership: new Set(['id', 'userId', 'laboratoryId', 'role']),
  SystemRoleAssignment: new Set(['id', 'userId', 'role']),
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

function sanitizeVal(
  entity: string,
  key: string,
  val: unknown,
  redactedList: string[],
  depth = 0,
  visitedCount = { count: 0 },
): unknown {
  if (depth > 5 || visitedCount.count > 100) {
    redactedList.push(key);
    return undefined;
  }
  visitedCount.count += 1;

  const normalized = normalizeKey(key);
  if (SENSITIVE_KEYS.has(normalized)) {
    redactedList.push(key);
    return undefined;
  }

  const allowlist = ALLOWED_ENTITY_KEYS[entity];
  if (!allowlist || !allowlist.has(key)) {
    redactedList.push(key);
    return undefined;
  }

  if (val === null || val === undefined) return val;

  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val
        .slice(0, 50)
        .map((item, idx) => sanitizeVal(entity, `${key}[${idx}]`, item, redactedList, depth + 1, visitedCount));
    }
    const sanitizedChild: Record<string, unknown> = {};
    for (const [cKey, cVal] of Object.entries(val as Record<string, unknown>)) {
      const cleaned = sanitizeVal(entity, cKey, cVal, redactedList, depth + 1, visitedCount);
      if (cleaned !== undefined) {
        sanitizedChild[cKey] = cleaned;
      }
    }
    return sanitizedChild;
  }

  return val;
}

function sanitizeJsonObject(
  entity: string,
  rawObj: unknown,
): { sanitized: Record<string, unknown> | null; redacted: string[] } {
  const allowlist = ALLOWED_ENTITY_KEYS[entity];
  if (!allowlist) {
    return { sanitized: null, redacted: ['*'] };
  }

  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return { sanitized: null, redacted: [] };
  }

  const obj = rawObj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const redacted: string[] = [];
  const visitedCount = { count: 0 };

  for (const [key, val] of Object.entries(obj)) {
    const cleaned = sanitizeVal(entity, key, val, redacted, 0, visitedCount);
    if (cleaned !== undefined) {
      sanitized[key] = cleaned;
    }
  }

  const jsonString = JSON.stringify(sanitized);
  if (Buffer.byteLength(jsonString, 'utf8') > 64 * 1024) {
    return { sanitized: null, redacted: ['payload_exceeds_64k'] };
  }

  return { sanitized: Object.keys(sanitized).length > 0 ? sanitized : null, redacted };
}

function computeFilterHash(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha256').update(str).digest('base64url');
}

export class PostgresManagementRepository implements ManagementRepository {
  public constructor(private readonly pool: DatabasePool) {}

  private async getLaboratoryTimezone(laboratoryId: string): Promise<string> {
    const res = await this.pool.query<{ timezone: string }>(
      `SELECT timezone FROM laboratories WHERE id = $1`,
      [laboratoryId],
    );
    const timezone = res.rows[0]?.timezone;
    if (!timezone) throw new ManagementLaboratoryNotFoundError(laboratoryId);
    return timezone;
  }

  public async getDashboardSummary(
    laboratoryId: string,
    access: DashboardSectionAccess,
  ): Promise<DashboardSummary> {
    const timezone = await this.getLaboratoryTimezone(laboratoryId);

    const equipmentPromise = access.equipment
      ? this.pool.query<{ id: string; name: string; status: 'AVAILABLE' | 'UNDER_EVALUATION' | 'UNAVAILABLE' | 'MAINTENANCE' }>(
          `SELECT id, name, status
             FROM equipment
            WHERE laboratory_id = $1 AND archived_at IS NULL
            ORDER BY id ASC`,
          [laboratoryId],
        )
      : Promise.resolve({ rows: [] });

    const reservationsPromise = access.scheduling
      ? this.pool.query<{
          id: string;
          equipment_id: string;
          equipment_name: string;
          starts_at: Date;
          ends_at: Date;
          purpose: string;
          status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';
        }>(
          `WITH day_bounds AS (
             SELECT ((now() AT TIME ZONE $2)::date AT TIME ZONE $2) AS starts_at,
                    (((now() AT TIME ZONE $2)::date + 1) AT TIME ZONE $2) AS ends_at
           )
           SELECT r.id, r.equipment_id, e.name AS equipment_name,
                  eo.starts_at, eo.ends_at, r.purpose, eo.status
             FROM reservations r
             JOIN equipment_occupations eo
               ON eo.id = r.id AND eo.laboratory_id = r.laboratory_id
             JOIN equipment e
               ON e.id = r.equipment_id AND e.laboratory_id = r.laboratory_id
             CROSS JOIN day_bounds d
            WHERE r.laboratory_id = $1
              AND r.archived_at IS NULL
              AND eo.archived_at IS NULL
              AND e.archived_at IS NULL
              AND eo.occupation_type = 'RESERVATION'
              AND eo.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
              AND eo.starts_at < d.ends_at
              AND eo.ends_at > d.starts_at
            ORDER BY eo.starts_at ASC, r.id ASC
            LIMIT 8`,
          [laboratoryId, timezone],
        )
      : Promise.resolve({ rows: [] });

    const inventoryPromise = access.inventory
      ? this.pool.query<{
          kind: 'LOW_STOCK' | 'EXPIRING' | 'EXPIRED';
          product_id: string;
          product_name: string;
          batch_id: string | null;
          batch_number: string | null;
          detail: string;
          priority_order: number;
        }>(
          `WITH batch_balances AS (
             SELECT b.id AS batch_id, b.product_id,
                    COALESCE(SUM(CASE
                      WHEN sm.movement_type = 'ENTRY' THEN sm.quantity
                      WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity
                      WHEN sm.movement_type = 'ADJUSTMENT' THEN sm.quantity
                      ELSE 0 END), 0) AS balance
               FROM batches b
          LEFT JOIN stock_movements sm
                 ON sm.batch_id = b.id AND sm.laboratory_id = $1
              WHERE b.laboratory_id = $1 AND b.archived_at IS NULL
              GROUP BY b.id, b.product_id
           ), product_balances AS (
             SELECT p.id AS product_id, p.name AS product_name,
                    p.minimum_stock_threshold,
                    COALESCE(SUM(bb.balance), 0) AS balance
               FROM products p
          LEFT JOIN batch_balances bb ON bb.product_id = p.id
              WHERE p.laboratory_id = $1 AND p.archived_at IS NULL
              GROUP BY p.id, p.name, p.minimum_stock_threshold
           ), alerts AS (
             SELECT 'LOW_STOCK'::text AS kind, pb.product_id, pb.product_name,
                    NULL::uuid AS batch_id, NULL::text AS batch_number,
                    ('Saldo ' || pb.balance || ' abaixo ou igual ao mínimo ' || pb.minimum_stock_threshold) AS detail,
                    3 AS priority_order
               FROM product_balances pb
              WHERE pb.minimum_stock_threshold > 0
                AND pb.balance <= pb.minimum_stock_threshold
             UNION ALL
             SELECT CASE WHEN b.expiration_date < ((now() AT TIME ZONE $2)::date AT TIME ZONE $2)
                         THEN 'EXPIRED' ELSE 'EXPIRING' END AS kind,
                    p.id, p.name, b.id, b.batch_number,
                    CASE WHEN b.expiration_date < ((now() AT TIME ZONE $2)::date AT TIME ZONE $2)
                         THEN 'Lote vencido'
                         ELSE 'Lote próximo do vencimento' END AS detail,
                    CASE WHEN b.expiration_date < ((now() AT TIME ZONE $2)::date AT TIME ZONE $2)
                         THEN 1 ELSE 2 END AS priority_order
               FROM batches b
               JOIN products p ON p.id = b.product_id AND p.laboratory_id = b.laboratory_id
               JOIN batch_balances bb ON bb.batch_id = b.id AND bb.balance > 0
              WHERE b.laboratory_id = $1
                AND b.archived_at IS NULL
                AND p.archived_at IS NULL
                AND b.expiration_date IS NOT NULL
                AND b.expiration_date < ((((now() AT TIME ZONE $2)::date + 31) AT TIME ZONE $2))
           )
           SELECT kind, product_id, product_name, batch_id, batch_number, detail, priority_order
             FROM alerts
            ORDER BY priority_order ASC, product_name ASC, batch_id ASC NULLS LAST
            LIMIT 8`,
          [laboratoryId, timezone],
        )
      : Promise.resolve({ rows: [] });

    const [equipmentResult, reservationsResult, inventoryResult] = await Promise.allSettled([
      equipmentPromise,
      reservationsPromise,
      inventoryPromise,
    ]);

    const equipmentRows = equipmentResult.status === 'fulfilled' ? equipmentResult.value.rows : [];
    const reservationRows = reservationsResult.status === 'fulfilled' ? reservationsResult.value.rows : [];
    const inventoryRows = inventoryResult.status === 'fulfilled' ? inventoryResult.value.rows : [];
    const byStatus = { AVAILABLE: 0, UNDER_EVALUATION: 0, UNAVAILABLE: 0, MAINTENANCE: 0 };
    for (const row of equipmentRows) byStatus[row.status] += 1;

    const equipmentActions = access.maintenance && equipmentResult.status === 'fulfilled'
      ? equipmentRows
          .filter(({ status }) => status !== 'AVAILABLE')
          .slice(0, 8)
          .map((row) => ({
            id: `equipment:${row.id}`,
            kind: 'EQUIPMENT_ATTENTION' as const,
            priority: row.status === 'UNAVAILABLE' ? 'HIGH' as const : 'MEDIUM' as const,
            title: row.name,
            detail: `Equipamento em estado ${row.status}.`,
            href: `/equipamentos?laboratory=${encodeURIComponent(laboratoryId)}`,
          }))
      : [];

    return dashboardSummarySchema.parse({
      laboratoryId,
      timezone,
      equipmentSummary: { total: equipmentRows.length, byStatus },
      todayReservations: reservationRows.map((row) => ({
        id: row.id,
        equipmentId: row.equipment_id,
        equipmentName: row.equipment_name,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        purpose: row.purpose,
        status: row.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED',
        href: `/agenda?reservationId=${encodeURIComponent(row.id)}`,
      })),
      upcomingActions: equipmentActions,
      inventoryAlerts: inventoryRows.map((row) => ({
        kind: row.kind,
        productId: row.product_id,
        productName: row.product_name,
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        detail: row.detail,
        href: row.batch_id
          ? `/estoque?batchId=${encodeURIComponent(row.batch_id)}`
          : `/estoque?productId=${encodeURIComponent(row.product_id)}`,
      })),
      quickActions: [],
      availability: {
        equipment: access.equipment && equipmentResult.status === 'fulfilled',
        scheduling: access.scheduling && reservationsResult.status === 'fulfilled',
        inventory: access.inventory && inventoryResult.status === 'fulfilled',
        maintenance: access.maintenance && equipmentResult.status === 'fulfilled',
        pendingActions: access.maintenance && equipmentResult.status === 'fulfilled',
      },
      generatedAt: new Date().toISOString(),
    });
  }

  public async getAnalytics(query: ManagementAnalyticsQuery): Promise<ManagementAnalytics> {
    const { laboratoryId, startsAt, endsAt } = query;
    const timezone = await this.getLaboratoryTimezone(laboratoryId);

    // 1. Equipment Metrics
    const eqCountRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM equipment WHERE laboratory_id = $1 AND archived_at IS NULL`,
      [laboratoryId],
    );
    const totalActiveEquipment = Number(eqCountRes.rows[0]?.count ?? 0);

    const hoursRes = await this.pool.query<{ hours: string; cnt: string }>(
      `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(eo.ends_at, $3::timestamptz) - GREATEST(eo.starts_at, $2::timestamptz))) / 3600), 0) AS hours,
              COUNT(DISTINCT r.id) AS cnt
         FROM equipment_occupations eo
         JOIN reservations r ON r.id = eo.id
        WHERE eo.laboratory_id = $1
          AND eo.occupation_type = 'RESERVATION'
          AND eo.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
          AND eo.archived_at IS NULL
          AND eo.starts_at < $3::timestamptz
          AND eo.ends_at > $2::timestamptz`,
      [laboratoryId, startsAt, endsAt],
    );

    const totalReservedHours = Math.round(Number(hoursRes.rows[0]?.hours ?? 0) * 10) / 10;
    const reservationCount = Number(hoursRes.rows[0]?.cnt ?? 0);

    // 2. Inventory Metrics
    const activeBatchesRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT b.id
           FROM batches b
      LEFT JOIN stock_movements sm ON sm.batch_id = b.id
          WHERE b.laboratory_id = $1
            AND b.status = 'AVAILABLE'
            AND b.archived_at IS NULL
       GROUP BY b.id
         HAVING COALESCE(SUM(CASE WHEN sm.movement_type IN ('ENTRY', 'ADJUSTMENT') THEN sm.quantity WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity ELSE 0 END), 0) > 0
       ) sub`,
      [laboratoryId],
    );
    const totalActiveBatches = Number(activeBatchesRes.rows[0]?.count ?? 0);

    const expiringBatchesRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT b.id
           FROM batches b
      LEFT JOIN stock_movements sm ON sm.batch_id = b.id
          WHERE b.laboratory_id = $1
            AND b.status = 'AVAILABLE'
            AND b.archived_at IS NULL
            AND b.expiration_date IS NOT NULL
            AND b.expiration_date >= (now() AT TIME ZONE $2)::date
            AND b.expiration_date <= ((now() AT TIME ZONE $2)::date + INTERVAL '31 days')
       GROUP BY b.id
         HAVING COALESCE(SUM(CASE WHEN sm.movement_type IN ('ENTRY', 'ADJUSTMENT') THEN sm.quantity WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity ELSE 0 END), 0) > 0
       ) sub`,
      [laboratoryId, timezone],
    );
    const expiringBatchesCount = Number(expiringBatchesRes.rows[0]?.count ?? 0);

    const lowStockRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
         FROM products p
        WHERE p.laboratory_id = $1
          AND p.archived_at IS NULL
          AND (
            SELECT COALESCE(SUM(CASE WHEN sm.movement_type IN ('ENTRY', 'ADJUSTMENT') THEN sm.quantity WHEN sm.movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -sm.quantity ELSE 0 END), 0)
              FROM stock_movements sm
             WHERE sm.product_id = p.id
          ) < p.minimum_stock_threshold`,
      [laboratoryId],
    );
    const lowStockProductsCount = Number(lowStockRes.rows[0]?.count ?? 0);

    const withdrawalsCountRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM stock_movements
        WHERE laboratory_id = $1
          AND movement_type = 'WITHDRAWAL'
          AND performed_at >= $2::timestamptz
          AND performed_at < $3::timestamptz`,
      [laboratoryId, startsAt, endsAt],
    );
    const totalWithdrawalsCount = Number(withdrawalsCountRes.rows[0]?.count ?? 0);

    return managementAnalyticsSchema.parse({
      laboratoryId,
      timezone,
      period: { startsAt, endsAt },
      equipmentMetrics: {
        totalActiveEquipment,
        totalReservedHours,
        reservationCount,
      },
      inventoryMetrics: {
        totalActiveBatches,
        lowStockProductsCount,
        expiringBatchesCount,
        totalWithdrawalsCount,
      },
      generatedAt: new Date().toISOString(),
    });
  }

  public async getProjectUsage(query: ProjectUsageQuery): Promise<ProjectUsagePage> {
    const { laboratoryId, startsAt, endsAt } = query;
    const limit = Number(query.limit ?? 20);

    // 1. Single set-based query for aggregated project metrics
    const metricsRes = await this.pool.query<{
      project_id: string | null;
      project_code: string | null;
      project_name: string;
      reserved_hours: string | number;
      reservation_count: string | number;
      withdrawal_count: string | number;
    }>(
      `WITH project_list AS (
         SELECT id, code, name FROM projects WHERE laboratory_id = $1
         UNION ALL
         SELECT NULL AS id, NULL AS code, 'Sem projeto associado' AS name
       ),
       project_reservations AS (
         SELECT r.project_id,
                COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(eo.ends_at, $3::timestamptz) - GREATEST(eo.starts_at, $2::timestamptz))) / 3600), 0) AS reserved_hours,
                COUNT(DISTINCT r.id)::int AS reservation_count
           FROM equipment_occupations eo
           JOIN reservations r ON r.id = eo.id
          WHERE eo.laboratory_id = $1
            AND eo.occupation_type = 'RESERVATION'
            AND eo.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
            AND eo.archived_at IS NULL
            AND eo.starts_at < $3::timestamptz
            AND eo.ends_at > $2::timestamptz
          GROUP BY r.project_id
       ),
       project_withdrawals AS (
         SELECT project_id,
                COUNT(*)::int AS withdrawal_count
           FROM stock_movements
          WHERE laboratory_id = $1
            AND movement_type = 'WITHDRAWAL'
            AND performed_at >= $2::timestamptz
            AND performed_at < $3::timestamptz
          GROUP BY project_id
       )
       SELECT pl.id AS project_id,
              pl.code AS project_code,
              pl.name AS project_name,
              COALESCE(pr.reserved_hours, 0) AS reserved_hours,
              COALESCE(pr.reservation_count, 0) AS reservation_count,
              COALESCE(pw.withdrawal_count, 0) AS withdrawal_count
         FROM project_list pl
         LEFT JOIN project_reservations pr ON (pl.id IS NULL AND pr.project_id IS NULL) OR (pl.id = pr.project_id)
         LEFT JOIN project_withdrawals pw ON (pl.id IS NULL AND pw.project_id IS NULL) OR (pl.id = pw.project_id)
        WHERE COALESCE(pr.reserved_hours, 0) > 0
           OR COALESCE(pr.reservation_count, 0) > 0
           OR COALESCE(pw.withdrawal_count, 0) > 0
        ORDER BY reserved_hours DESC, withdrawal_count DESC, pl.id ASC`,
      [laboratoryId, startsAt, endsAt],
    );

    // 2. Single set-based query for consumed products across all projects in the period
    const consumedRes = await this.pool.query<{
      project_id: string | null;
      product_id: string;
      product_code: string;
      product_name: string;
      unit_of_measure: 'ML' | 'L' | 'G' | 'KG' | 'UNIDADE' | 'CAIXA' | 'FRASCO' | 'PACOTE';
      total_quantity: string | number;
    }>(
      `SELECT sm.project_id,
              p.id AS product_id,
              p.code AS product_code,
              p.name AS product_name,
              p.unit_of_measure,
              SUM(ABS(sm.quantity)) AS total_quantity
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
        WHERE sm.laboratory_id = $1
          AND sm.movement_type = 'WITHDRAWAL'
          AND sm.performed_at >= $2::timestamptz
          AND sm.performed_at < $3::timestamptz
        GROUP BY sm.project_id, p.id, p.code, p.name, p.unit_of_measure
        ORDER BY total_quantity DESC`,
      [laboratoryId, startsAt, endsAt],
    );

    // Group consumed products by project_id
    const consumedByProject = new Map<string | null, Array<{
      productId: string;
      productCode: string;
      productName: string;
      unitOfMeasure: 'ML' | 'L' | 'G' | 'KG' | 'UNIDADE' | 'CAIXA' | 'FRASCO' | 'PACOTE';
      totalQuantity: number;
    }>>();

    for (const row of consumedRes.rows) {
      const projKey = row.project_id;
      let list = consumedByProject.get(projKey);
      if (!list) {
        list = [];
        consumedByProject.set(projKey, list);
      }
      if (list.length < 50) {
        list.push({
          productId: row.product_id,
          productCode: row.product_code,
          productName: row.product_name,
          unitOfMeasure: row.unit_of_measure,
          totalQuantity: Number(row.total_quantity),
        });
      }
    }

    const projectSummaries: ProjectUsageSummary[] = metricsRes.rows.map((row) => ({
      projectId: row.project_id,
      projectCode: row.project_code,
      projectName: row.project_name,
      reservedHours: Math.round(Number(row.reserved_hours) * 10) / 10,
      reservationCount: Number(row.reservation_count),
      withdrawalCount: Number(row.withdrawal_count),
      consumedProducts: consumedByProject.get(row.project_id) ?? [],
    }));

    const items = projectSummaries.slice(0, limit);
    const hasNextPage = projectSummaries.length > limit;

    return projectUsagePageSchema.parse({
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: null,
      },
    });
  }

  public async listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage> {
    const limit = Number(query.limit ?? 25);
    const searchActorPattern = query.actorId ? query.actorId : null;

    const filterHashObj = {
      lab: query.laboratoryId,
      startsAt: query.startsAt,
      endsAt: query.endsAt,
      actorId: query.actorId ?? null,
      action: query.action ?? null,
      entity: query.entity ?? null,
    };
    const expectedHash = computeFilterHash(filterHashObj);

    let cursorPayload = query.cursor ? decodeAuditCursor(query.cursor) : null;
    if (cursorPayload && cursorPayload.filterHash !== expectedHash) {
      cursorPayload = null;
    }

    const cursorOccurredAt = cursorPayload?.occurredAt ?? null;
    const cursorId = cursorPayload?.id ?? null;

    const result = await this.pool.query<AuditRow>(
      `SELECT a.id, a.occurred_at, a.actor_id, u.name AS actor_name,
              a.action, a.entity, a.entity_id, a.laboratory_id, a.origin,
              a.before, a.after
         FROM audit_events a
    LEFT JOIN users u ON u.id = a.actor_id
        WHERE ($1::uuid IS NULL OR a.laboratory_id = $1)
          AND a.occurred_at >= $2::timestamptz
          AND a.occurred_at < $3::timestamptz
          AND ($4::uuid IS NULL OR a.actor_id = $4)
          AND ($5::text IS NULL OR a.action = $5)
          AND ($6::text IS NULL OR a.entity = $6)
          AND ($7::timestamptz IS NULL OR (a.occurred_at, a.id) < ($7::timestamptz, $8::uuid))
        ORDER BY a.occurred_at DESC, a.id DESC
        LIMIT $9`,
      [
        query.laboratoryId,
        query.startsAt,
        query.endsAt,
        searchActorPattern,
        query.action ?? null,
        query.entity ?? null,
        cursorOccurredAt,
        cursorId,
        limit + 1,
      ],
    );

    const hasNextPage = result.rows.length > limit;
    const rawItems = result.rows.slice(0, limit);

    const items = rawItems.map((row) =>
      auditLogSummarySchema.parse({
        id: row.id,
        occurredAt: row.occurred_at.toISOString(),
        actorId: row.actor_id,
        actorName: row.actor_name ?? 'Sistema',
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        laboratoryId: row.laboratory_id,
        origin: row.origin,
      }),
    );

    let nextCursor: string | null = null;
    if (hasNextPage && rawItems.length > 0) {
      const last = rawItems.at(-1)!;
      nextCursor = encodeAuditCursor({
        v: 1,
        occurredAt: last.occurred_at.toISOString(),
        id: last.id,
        filterHash: expectedHash,
      });
    }

    return auditLogPageSchema.parse({
      items,
      pageInfo: {
        hasNextPage,
        nextCursor,
      },
    });
  }

  public async getAuditLogDetail(
    auditEventId: string,
    laboratoryId: string,
  ): Promise<AuditLogDetail | null> {
    const result = await this.pool.query<AuditRow>(
      `SELECT a.id, a.occurred_at, a.actor_id, u.name AS actor_name,
              a.action, a.entity, a.entity_id, a.laboratory_id, a.origin,
              a.before, a.after
         FROM audit_events a
    LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.id = $1 AND ($2::uuid IS NULL OR a.laboratory_id = $2)`,
      [auditEventId, laboratoryId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const beforeSanitized = sanitizeJsonObject(row.entity, row.before);
    const afterSanitized = sanitizeJsonObject(row.entity, row.after);

    const redactedFields = Array.from(
      new Set([...beforeSanitized.redacted, ...afterSanitized.redacted]),
    );

    return auditLogDetailSchema.parse({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      actorId: row.actor_id,
      actorName: row.actor_name ?? 'Sistema',
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      laboratoryId: row.laboratory_id,
      origin: row.origin,
      before: beforeSanitized.sanitized,
      after: afterSanitized.sanitized,
      redactedFields,
    });
  }
}
