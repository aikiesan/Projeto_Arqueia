import { fieldReportParamsSchema } from '@arqueia/contracts';

import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

interface RouteContext {
  params: Promise<{ fieldReportId: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  const parsed = fieldReportParamsSchema.safeParse(await context.params);
  if (!parsed.success) return noStoreJson({ code: 'INVALID_FIELD_REPORT_ID' }, 400);
  return authorizedApiRequest(
    request,
    `/api/field-reports/${encodeURIComponent(parsed.data.fieldReportId)}`,
    'PATCH',
  );
}
