import type { OidcProviderMetadata } from '@arqueia/contracts';

import type { OidcProvider } from '../domain/ports/oidc-provider.port.js';

export interface OidcProviderConfig {
  readonly enabled: boolean;
  readonly displayName: string;
  readonly authorizationUrl: string | null;
}

export class ConfiguredOidcProvider implements OidcProvider {
  public constructor(private readonly config: OidcProviderConfig) {}

  public getMetadata(): OidcProviderMetadata {
    return { ...this.config };
  }
}
