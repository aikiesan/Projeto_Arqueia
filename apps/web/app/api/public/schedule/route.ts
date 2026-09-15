import { publicScheduleQuerySchema, publicScheduleResponseSchema } from '@arqueia/contracts';

import { apiBaseUrl } from '../../../lib/api-server';

/**
 * Proxy da agenda pública. Não exige sessão nem checa Origin: é leitura aberta,
 * por decisão do laboratório. Ainda assim revalida entrada e saída com os
 * mesmos contratos, para que a página nunca receba mais do que o combinado.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = publicScheduleQuerySchema.safeParse({
    laboratoryId: url.searchParams.get('laboratoryId') ?? undefined,
    startsAt: url.searchParams.get('startsAt') ?? undefined,
    endsAt: url.searchParams.get('endsAt') ?? undefined,
  });

  if (!parsed.success) {
    return jsonResponse({ code: 'INVALID_PUBLIC_SCHEDULE_QUERY' }, 400);
  }

  const upstream = new URL(`${apiBaseUrl()}/api/public/schedule`);
  upstream.searchParams.set('laboratoryId', parsed.data.laboratoryId);
  upstream.searchParams.set('startsAt', parsed.data.startsAt);
  upstream.searchParams.set('endsAt', parsed.data.endsAt);

  const response = await fetch(upstream, { cache: 'no-store' }).catch(() => null);
  if (!response) return jsonResponse({ code: 'UPSTREAM_UNAVAILABLE' }, 502);
  if (response.status === 404) return jsonResponse({ code: 'LABORATORY_NOT_FOUND' }, 404);
  if (!response.ok) return jsonResponse({ code: 'UPSTREAM_ERROR' }, 502);

  const payload = publicScheduleResponseSchema.safeParse(await response.json().catch(() => null));
  if (!payload.success) return jsonResponse({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);

  return jsonResponse(payload.data);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      // Curto o bastante para a agenda parecer viva, longo o bastante para
      // absorver um pico de acessos vindos do site público.
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
