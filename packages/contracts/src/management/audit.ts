import { z } from 'zod';

import { uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const listAuditLogsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    actorId: uuidSchema.optional(),
    action: z.string().trim().min(1).max(120).optional(),
    entity: z.string().trim().min(1).max(80).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .refine(
    (data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
    {
      message: 'A data final deve ser estritamente posterior à data inicial.',
      path: ['endsAt'],
    },
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime();
      const maxMs = 90 * 24 * 60 * 60 * 1000; // 90 dias
      return diffMs <= maxMs;
    },
    {
      message: 'O intervalo da auditoria não pode exceder 90 dias.',
      path: ['endsAt'],
    },
  );

export const auditLogSummarySchema = z
  .object({
    id: uuidSchema,
    occurredAt: z.string().datetime(),
    actorId: uuidSchema.nullable(),
    actorName: z.string(),
    action: z.string(),
    entity: z.string(),
    entityId: z.string(),
    laboratoryId: uuidSchema.nullable(),
    origin: z.string(),
  })
  .strict();

export const auditLogDetailSchema = auditLogSummarySchema
  .extend({
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    redactedFields: z.array(z.string()),
  })
  .strict();

export const auditLogPageSchema = createCursorPageSchema(auditLogSummarySchema).strict();
export const auditLogParamsSchema = z.object({ auditEventId: uuidSchema }).strict();

export const auditCursorPayloadSchema = z.object({
  v: z.literal(1),
  occurredAt: z.string().datetime(),
  id: uuidSchema,
  filterHash: z.string(),
});

export type AuditCursorPayload = z.infer<typeof auditCursorPayloadSchema>;

export function encodeAuditCursor(payload: AuditCursorPayload): string {
  const jsonStr = JSON.stringify(payload);
  return Buffer.from(jsonStr, 'utf8').toString('base64url');
}

export function decodeAuditCursor(cursorStr: string): AuditCursorPayload | null {
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const obj: unknown = JSON.parse(jsonStr);
    return auditCursorPayloadSchema.parse(obj);
  } catch {
    return null;
  }
}

export type ListAuditLogsQuery = z.input<typeof listAuditLogsQuerySchema>;
export type AuditLogSummary = z.infer<typeof auditLogSummarySchema>;
export type AuditLogDetail = z.infer<typeof auditLogDetailSchema>;
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;
