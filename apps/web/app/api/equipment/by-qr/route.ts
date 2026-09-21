import { authorizedApiRequest } from '../../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  return authorizedApiRequest(request, `/api/equipment/by-qr${new URL(request.url).search}`);
}
