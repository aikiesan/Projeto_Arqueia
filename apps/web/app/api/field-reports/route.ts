import { listFieldReportsQuerySchema } from '@arqueia/contracts';

import { authorizedApiRequest, noStoreJson } from '../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = listFieldReportsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Promise.resolve(noStoreJson({ code: 'INVALID_QUERY' }, 400));

  const query = new URLSearchParams({
    laboratoryId: parsed.data.laboratoryId,
    limit: String(parsed.data.limit),
  });
  if (parsed.data.kind) query.set('kind', parsed.data.kind);
  if (parsed.data.status) query.set('status', parsed.data.status);
  if (parsed.data.cursor) query.set('cursor', parsed.data.cursor);
  return authorizedApiRequest(request, `/api/field-reports?${query.toString()}`);
}
