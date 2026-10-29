import { hasTrustedOrigin, noStoreJson, publicApiRequest } from '../../../../lib/api-server';

export function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Promise.resolve(noStoreJson({ code: 'INVALID_ORIGIN' }, 403));
  }
  return publicApiRequest(request, '/api/auth/password-reset/complete');
}
