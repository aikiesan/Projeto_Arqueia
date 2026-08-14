import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'arqueia_session';
const MAX_BODY_BYTES = 65_536;

export function apiBaseUrl(): string {
  const configured = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (configured === undefined) throw new Error('API_INTERNAL_URL não configurada.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocolo inválido para API.');
  return url.toString().replace(/\/$/, '');
}

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin === null || host === null) return false;
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.host === host;
  } catch {
    return false;
  }
}

export function noStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function authorizedApiRequest(
  request: Request,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
): Promise<Response> {
  const token = await sessionToken();
  if (token === null) return noStoreJson({ code: 'UNAUTHENTICATED' }, 401);

  let body: string | undefined;
  if (method !== 'GET') {
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return noStoreJson({ code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
  }

  try {
    const upstream = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Request-Id': crypto.randomUUID(),
      },
      ...(body === undefined ? {} : { body }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return noStoreJson(
      { code: 'API_UNAVAILABLE', message: 'Serviço temporariamente indisponível.' },
      503,
    );
  }
}
