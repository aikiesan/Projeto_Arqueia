import { cookies } from 'next/headers';

import { hasTrustedOrigin, noStoreJson, SESSION_COOKIE_NAME, SESSION_COOKIE_PATH } from '../../../lib/api-server';

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  (await cookies()).set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: SESSION_COOKIE_PATH,
    maxAge: 0,
  });
  return noStoreJson({ ok: true });
}
