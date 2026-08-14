import { projectUsagePageSchema } from '@arqueia/contracts';

import { authorizedApiRequest } from '../../../lib/api-server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = `/api/management/project-usage${url.search}`;
  const response = await authorizedApiRequest(request, path, 'GET');

  if (!response.ok) {
    return response;
  }

  const payload: unknown = await response.json();
  const parsed = projectUsagePageSchema.parse(payload);

  return Response.json(parsed, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
