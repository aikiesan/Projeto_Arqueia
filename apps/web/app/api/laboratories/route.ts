import { authorizedApiRequest } from '../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  return authorizedApiRequest(request, '/api/laboratories');
}
