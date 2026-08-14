import { authenticatedPrincipalSchema } from '@arqueia/contracts';
import { cookies } from 'next/headers';

import {
  apiBaseUrl,
  noStoreJson,
  SESSION_COOKIE_NAME,
  sessionToken,
} from '../../lib/api-server';

export async function GET(): Promise<Response> {
  const token = await sessionToken();
  if (token === null) return noStoreJson({ code: 'UNAUTHENTICATED' }, 401);

  try {
    const upstream = await fetch(`${apiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      if (upstream.status === 401) (await cookies()).delete(SESSION_COOKIE_NAME);
      return noStoreJson({ code: 'UNAUTHENTICATED' }, 401);
    }
    return noStoreJson({ principal: authenticatedPrincipalSchema.parse(await upstream.json()) });
  } catch {
    return noStoreJson({ code: 'API_UNAVAILABLE' }, 503);
  }
}
