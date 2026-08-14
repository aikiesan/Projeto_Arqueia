import { userAccessQuerySchema } from '@arqueia/contracts';

import { authorizedApiRequest, noStoreJson } from '../../lib/api-server';

export function GET(request: Request): Promise<Response> {
  const parsed = userAccessQuerySchema.safeParse({
    userId: new URL(request.url).searchParams.get('userId'),
  });
  if (!parsed.success) {
    return Promise.resolve(noStoreJson({ code: 'VALIDATION_ERROR' }, 400));
  }

  const query = new URLSearchParams({ userId: parsed.data.userId });
  return authorizedApiRequest(request, `/api/access?${query.toString()}`);
}
