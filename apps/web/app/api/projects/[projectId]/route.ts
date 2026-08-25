import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

interface RouteContext {
  readonly params: Promise<{ readonly projectId: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  const { projectId } = await context.params;
  return authorizedApiRequest(request, `/api/projects/${encodeURIComponent(projectId)}`, 'PATCH');
}
