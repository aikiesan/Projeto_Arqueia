import { dashboardSummarySchema, uuidSchema } from '@arqueia/contracts';

import { authorizedApiRequest, noStoreJson } from '../../../lib/api-server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const laboratoryId = url.searchParams.get('laboratoryId');

  const labValidation = uuidSchema.safeParse(laboratoryId);
  if (!labValidation.success) {
    return noStoreJson(
      { code: 'INVALID_LABORATORY_ID', message: 'laboratoryId deve ser um UUID válido.' },
      400,
    );
  }

  const validLabId = labValidation.data;
  const path = `/api/management/dashboard?laboratoryId=${encodeURIComponent(validLabId)}`;
  const response = await authorizedApiRequest(request, path, 'GET');

  if (!response.ok) {
    return response;
  }

  const payload: unknown = await response.json();
  const parsed = dashboardSummarySchema.safeParse(payload);

  if (!parsed.success) {
    return noStoreJson(
      { code: 'UPSTREAM_INCOMPATIBLE', message: 'Resposta upstream incompatível com o contrato.' },
      502,
    );
  }

  if (parsed.data.laboratoryId !== validLabId) {
    return noStoreJson(
      {
        code: 'UPSTREAM_SCOPE_MISMATCH',
        message: 'Resposta upstream incompatível com o laboratório solicitado.',
      },
      502,
    );
  }

  return noStoreJson(parsed.data, 200);
}
