import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

interface RouteContext {
  readonly params: Promise<{ readonly userId: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  const { userId } = await context.params;
  return authorizedApiRequest(request, `/api/users/${encodeURIComponent(userId)}`, 'PATCH');
}
