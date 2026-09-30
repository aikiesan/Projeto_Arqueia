import { fieldReportSummaryQuerySchema } from '@arqueia/contracts';

import { authorizedApiRequest, noStoreJson } from '../../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = fieldReportSummaryQuerySchema.safeParse({
    laboratoryId: url.searchParams.get('laboratoryId') ?? undefined,
  });
  if (!parsed.success) return Promise.resolve(noStoreJson({ code: 'INVALID_QUERY' }, 400));

  const query = new URLSearchParams({ laboratoryId: parsed.data.laboratoryId });
  return authorizedApiRequest(request, `/api/field-reports/summary?${query.toString()}`);
}
