import { submitFieldReportInputSchema, submitFieldReportResultSchema } from '@arqueia/contracts';

import {
  apiBaseUrl,
  forwardedClientIp,
  hasTrustedOrigin,
  noStoreJson,
} from '../../../lib/api-server';
import { FIELD_REPORT_HONEYPOT_FIELD } from '../../../lib/field-report-honeypot';

/** Um informe é texto curto: 16 KiB cobre a mensagem com folga. */
const MAX_BODY_BYTES = 16_384;

/**
 * Envio público de informes (sem sessão). Exige mesma origem, limita o corpo,
 * descarta robôs pelo campo-armadilha, revalida com o contrato e repassa o IP
 * do cliente para o limite de envios da API.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return noStoreJson({ code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return noStoreJson({ code: 'INVALID_INPUT', message: 'Revise os campos do informe.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return noStoreJson({ code: 'INVALID_INPUT', message: 'Revise os campos do informe.' }, 400);
  }

  const { [FIELD_REPORT_HONEYPOT_FIELD]: honeypot, ...fields } = body as Record<string, unknown>;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return noStoreJson(
      { reference: 'INF-00000000', receivedAt: new Date().toISOString() },
      201,
    );
  }

  const parsed = submitFieldReportInputSchema.safeParse(fields);
  if (!parsed.success) {
    return noStoreJson(
      {
        code: 'INVALID_INPUT',
        message: parsed.error.issues[0]?.message ?? 'Revise os campos do informe.',
      },
      400,
    );
  }

  try {
    const upstream = await fetch(`${apiBaseUrl()}/api/public/field-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': crypto.randomUUID(),
        'X-Forwarded-For': forwardedClientIp(request),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 429) {
      const response = noStoreJson(
        {
          code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED',
          message: 'Muitos informes em pouco tempo. Aguarde alguns minutos e tente de novo.',
        },
        429,
      );
      const retryAfter = upstream.headers.get('retry-after');
      if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
        response.headers.set('Retry-After', retryAfter);
      }
      return response;
    }
    if (upstream.status === 400 || upstream.status === 404) {
      const payload = (await upstream.json().catch(() => null)) as { code?: string } | null;
      return noStoreJson(
        {
          code: payload?.code ?? 'INVALID_INPUT',
          message: 'Laboratório ou equipamento não encontrado. Atualize a página e tente de novo.',
        },
        upstream.status,
      );
    }
    if (!upstream.ok) return noStoreJson({ code: 'UPSTREAM_ERROR' }, 502);

    const result = submitFieldReportResultSchema.safeParse(await upstream.json().catch(() => null));
    if (!result.success) return noStoreJson({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);
    return noStoreJson(result.data, 201);
  } catch {
    return noStoreJson(
      { code: 'API_UNAVAILABLE', message: 'Não foi possível enviar agora. Tente novamente.' },
      503,
    );
  }
}
