import { localLoginInputSchema, loginResponseSchema } from '@arqueia/contracts';
import { cookies } from 'next/headers';

import {
  apiBaseUrl,
  hasTrustedOrigin,
  noStoreJson,
  SESSION_COOKIE_NAME,
} from '../../../lib/api-server';

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);

  const parsed = localLoginInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStoreJson({ code: 'INVALID_INPUT', message: 'Revise e-mail e senha.' }, 400);
  }

  try {
    const upstream = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID() },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      return noStoreJson(
        { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
        upstream.status === 401 ? 401 : 503,
      );
    }

    const login = loginResponseSchema.parse(await upstream.json());
    (await cookies()).set(SESSION_COOKIE_NAME, login.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: login.expiresInSeconds,
      priority: 'high',
    });
    return noStoreJson({ principal: login.principal, expiresInSeconds: login.expiresInSeconds });
  } catch {
    return noStoreJson(
      { code: 'API_UNAVAILABLE', message: 'Não foi possível entrar agora.' },
      503,
    );
  }
}
