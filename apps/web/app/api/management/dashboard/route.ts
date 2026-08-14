import { dashboardSummarySchema } from '@arqueia/contracts';

import { authorizedApiRequest, noStoreJson } from '../../../lib/api-server';

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const upstream = await authorizedApiRequest(request, `/api/management/dashboard?${query.toString()}`);
  if (!upstream.ok) return upstream;
  try {
    return noStoreJson(dashboardSummarySchema.parse(await upstream.json()));
  } catch {
    return noStoreJson({ code: 'INVALID_UPSTREAM_RESPONSE' }, 502);
  }
}
