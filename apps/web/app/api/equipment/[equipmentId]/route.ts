import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

export function PATCH(
  request: Request,
  context: { readonly params: Promise<{ readonly equipmentId: string }> },
): Promise<Response> {
  if (!hasTrustedOrigin(request)) return Promise.resolve(noStoreJson({ code: 'INVALID_ORIGIN' }, 403));
  return context.params.then(({ equipmentId }) =>
    authorizedApiRequest(request, `/api/equipment/${encodeURIComponent(equipmentId)}`, 'PATCH'),
  );
}
