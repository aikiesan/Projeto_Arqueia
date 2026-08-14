import type { OidcProviderMetadata } from '@arqueia/contracts';

export interface OidcProvider {
  getMetadata(): OidcProviderMetadata;
}

export const OIDC_PROVIDER = Symbol('OIDC_PROVIDER');
