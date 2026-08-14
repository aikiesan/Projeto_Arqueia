import { authorizedApiRequest } from '../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return authorizedApiRequest(request, `/api/inventory/batches${url.search}`);
}
