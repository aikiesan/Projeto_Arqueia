import { oidcProviderMetadataSchema, type OidcProviderMetadata } from '@arqueia/contracts';

import { apiBaseUrl } from '../lib/api-server';
import { LoginForm } from './login-form';

const DISABLED_OIDC: OidcProviderMetadata = {
  enabled: false,
  displayName: 'SSO',
  authorizationUrl: null,
};

async function loadOidcMetadata(): Promise<OidcProviderMetadata> {
  try {
    const upstream = await fetch(`${apiBaseUrl()}/api/auth/oidc`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return DISABLED_OIDC;
    const parsed = oidcProviderMetadataSchema.safeParse(await upstream.json());
    return parsed.success ? parsed.data : DISABLED_OIDC;
  } catch {
    return DISABLED_OIDC;
  }
}

function safeNext(next: string | undefined): string {
  if (typeof next !== 'string') return '/';
  // Only allow internal, absolute paths — never open redirects.
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly next?: string }>;
}) {
  const [{ next }, oidc] = await Promise.all([searchParams, loadOidcMetadata()]);
  return <LoginForm next={safeNext(next)} oidc={oidc} />;
}
