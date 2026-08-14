import type { AuthenticatedPrincipal } from '@arqueia/contracts';

export interface IssuedAccessToken {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
}

export interface AccessTokenIssuer {
  issue(principal: AuthenticatedPrincipal): Promise<IssuedAccessToken>;
}

export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');
