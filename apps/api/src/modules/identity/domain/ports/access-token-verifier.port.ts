export interface VerifiedAccessToken {
  readonly subject: string;
}

export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<VerifiedAccessToken | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
