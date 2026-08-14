import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

export function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Promise.resolve(noStoreJson({ code: 'INVALID_ORIGIN' }, 403));
  }
  return authorizedApiRequest(request, '/api/access/system-roles', 'POST');
}
