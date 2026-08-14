import { cookies } from 'next/headers';

import { hasTrustedOrigin, noStoreJson, SESSION_COOKIE_NAME } from '../../../lib/api-server';

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return noStoreJson({ ok: true });
}
