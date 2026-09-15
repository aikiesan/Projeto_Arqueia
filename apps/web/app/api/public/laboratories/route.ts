import { publicLaboratoryListSchema } from '@arqueia/contracts';

import { apiBaseUrl } from '../../../lib/api-server';

/** Laboratórios com agenda pública. Leitura aberta, sem sessão. */
export async function GET(): Promise<Response> {
  const response = await fetch(`${apiBaseUrl()}/api/public/laboratories`, {
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) {
    return Response.json({ code: 'UPSTREAM_UNAVAILABLE' }, { status: 502 });
  }

  const parsed = publicLaboratoryListSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ code: 'UPSTREAM_INCOMPATIBLE' }, { status: 502 });
  }

  return Response.json(parsed.data, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
