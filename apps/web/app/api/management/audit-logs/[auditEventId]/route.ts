import { auditLogDetailSchema } from '@arqueia/contracts';

import { authorizedApiRequest } from '../../../../lib/api-server';

interface RouteContext {
  readonly params: Promise<{ readonly auditEventId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const url = new URL(request.url);
  const { auditEventId } = await context.params;
  const response = await authorizedApiRequest(
    request,
    `/api/management/audit-logs/${encodeURIComponent(auditEventId)}${url.search}`,
  );
  if (!response.ok) return response;

  const data: unknown = await response.json();
  const validated = auditLogDetailSchema.parse(data);
  return Response.json(validated);
}
