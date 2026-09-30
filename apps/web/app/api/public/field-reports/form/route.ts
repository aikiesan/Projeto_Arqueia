import { publicFieldReportFormQuerySchema, publicFieldReportFormSchema } from '@arqueia/contracts';

import { apiBaseUrl } from '../../../../lib/api-server';

/**
 * Opções do formulário público de informes: laboratório e equipamentos ativos
 * (id, código e nome — o mesmo que a agenda pública já mostra). Revalida entrada
 * e saída com o contrato para que a página nunca receba mais do que o combinado.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = publicFieldReportFormQuerySchema.safeParse({
    laboratoryId: url.searchParams.get('laboratoryId') ?? undefined,
  });
  if (!parsed.success) return jsonResponse({ code: 'INVALID_FIELD_REPORT_FORM_QUERY' }, 400);

  const upstream = new URL(`${apiBaseUrl()}/api/public/field-reports/form`);
  upstream.searchParams.set('laboratoryId', parsed.data.laboratoryId);

  const response = await fetch(upstream, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return jsonResponse({ code: 'UPSTREAM_UNAVAILABLE' }, 502);
  if (response.status === 404) return jsonResponse({ code: 'LABORATORY_NOT_FOUND' }, 404);
  if (!response.ok) return jsonResponse({ code: 'UPSTREAM_ERROR' }, 502);

  const payload = publicFieldReportFormSchema.safeParse(await response.json().catch(() => null));
  if (!payload.success) return jsonResponse({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);

  return jsonResponse(payload.data);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
