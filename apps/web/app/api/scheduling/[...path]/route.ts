import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api\/scheduling/, '/api/scheduling');
  return authorizedApiRequest(request, `${targetPath}${url.search}`);
}

export function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Promise.resolve(noStoreJson({ code: 'INVALID_ORIGIN' }, 403));
  }
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api\/scheduling/, '/api/scheduling');
  return authorizedApiRequest(request, `${targetPath}${url.search}`, 'POST');
}
