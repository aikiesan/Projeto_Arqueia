import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../../lib/api-server';

interface RouteContext {
  readonly params: Promise<{ readonly membershipId: string }>;
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!hasTrustedOrigin(request)) return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  const { membershipId } = await context.params;
  return authorizedApiRequest(
    request,
    `/api/access/memberships/${encodeURIComponent(membershipId)}`,
    'DELETE',
  );
}
