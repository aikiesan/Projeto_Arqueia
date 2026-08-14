import { oidcProviderMetadataSchema } from '@arqueia/contracts';

import { apiBaseUrl, noStoreJson } from '../../../lib/api-server';

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${apiBaseUrl()}/api/auth/oidc`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return noStoreJson({ enabled: false }, 200);
    const metadata = oidcProviderMetadataSchema.parse(await upstream.json());
    return noStoreJson(metadata);
  } catch {
    return noStoreJson({ enabled: false }, 200);
  }
}
