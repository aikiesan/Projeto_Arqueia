import { IDENTITY_CONTRACT_VERSION, type AuthenticatedPrincipal } from '@arqueia/contracts';
import type { JwtService } from '@nestjs/jwt';

import type {
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../domain/ports/access-token-issuer.port.js';

export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  public constructor(
    private readonly jwt: JwtService,
    private readonly expiresInSeconds: number,
  ) {}

  public async issue(principal: AuthenticatedPrincipal): Promise<IssuedAccessToken> {
    const accessToken = await this.jwt.signAsync({
      sub: principal.user.id,
      token_use: 'access',
      contract_version: IDENTITY_CONTRACT_VERSION,
    });

    return { accessToken, expiresInSeconds: this.expiresInSeconds };
  }
}
