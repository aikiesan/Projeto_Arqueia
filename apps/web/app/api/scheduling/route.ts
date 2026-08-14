import { listScheduleQuerySchema, scheduleResponseSchema } from '@arqueia/contracts';

import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../lib/api-server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsedQuery = listScheduleQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsedQuery.success) {
    return noStoreJson({ code: 'INVALID_SCHEDULE_QUERY' }, 400);
  }

  const query = new URLSearchParams({
    laboratoryId: parsedQuery.data.laboratoryId,
    startsAt: parsedQuery.data.startsAt,
    endsAt: parsedQuery.data.endsAt,
    onlyMine: String(parsedQuery.data.onlyMine),
    includeCancelled: String(parsedQuery.data.includeCancelled),
  });
  if (parsedQuery.data.equipmentId) query.set('equipmentId', parsedQuery.data.equipmentId);
  if (parsedQuery.data.status) query.set('status', parsedQuery.data.status);

  const response = await authorizedApiRequest(request, `/api/scheduling?${query.toString()}`);
  if (!response.ok) return response;

  const payload: unknown = await response.json();
  const parsedResponse = scheduleResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    return noStoreJson({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);
  }
  if (parsedResponse.data.laboratoryId !== parsedQuery.data.laboratoryId) {
    return noStoreJson({ code: 'UPSTREAM_SCOPE_MISMATCH' }, 502);
  }

  return noStoreJson(parsedResponse.data);
}

export function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Promise.resolve(noStoreJson({ code: 'INVALID_ORIGIN' }, 403));
  }
  return Promise.resolve(noStoreJson({ code: 'ROUTE_NOT_FOUND' }, 404));
}
