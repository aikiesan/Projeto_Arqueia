import { managementAnalyticsSchema } from '@arqueia/contracts';

import { authorizedApiRequest } from '../../../lib/api-server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const response = await authorizedApiRequest(request, `/api/management/analytics${url.search}`);
  if (!response.ok) return response;

  const data: unknown = await response.json();
  const validated = managementAnalyticsSchema.parse(data);
  return Response.json(validated);
}
