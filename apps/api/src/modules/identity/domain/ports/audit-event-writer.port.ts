export interface AppendAuditEventInput {
  readonly actorId: string | null;
  readonly laboratoryId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly before: unknown | null;
  readonly after: unknown | null;
  readonly origin: string;
  readonly requestId: string | null;
}

export interface AuditEventWriter {
  append(input: AppendAuditEventInput): Promise<void>;
}

export const AUDIT_EVENT_WRITER = Symbol('AUDIT_EVENT_WRITER');
