import type { FieldReportRequestContext } from '../domain/ports/field-report-repository.port.js';

export function requestContext(origin: string, requestId?: string): FieldReportRequestContext {
  return {
    origin,
    requestId: requestId !== undefined && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null,
  };
}
