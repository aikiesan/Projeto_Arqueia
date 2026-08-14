import type { DatabasePool } from '@arqueia/database';

import type {
  AppendAuditEventInput,
  AuditEventWriter,
} from '../domain/ports/audit-event-writer.port.js';

export class PostgresAuditEventWriter implements AuditEventWriter {
  public constructor(private readonly pool: DatabasePool) {}

  public async append(input: AppendAuditEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (
         actor_id, laboratory_id, action, entity, entity_id,
         before, after, origin, request_id
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        input.actorId,
        input.laboratoryId,
        input.action,
        input.entity,
        input.entityId,
        input.before === null ? null : JSON.stringify(input.before),
        input.after === null ? null : JSON.stringify(input.after),
        input.origin,
        input.requestId,
      ],
    );
  }
}
