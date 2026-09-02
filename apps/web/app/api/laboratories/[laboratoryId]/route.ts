import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

interface RouteContext {
  readonly params: Promise<{ readonly laboratoryId: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  const { laboratoryId } = await context.params;
  return authorizedApiRequest(
    request,
    `/api/laboratories/${encodeURIComponent(laboratoryId)}`,
    'PATCH',
  );
}
