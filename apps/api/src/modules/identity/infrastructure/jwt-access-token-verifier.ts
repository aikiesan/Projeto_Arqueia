import { IDENTITY_CONTRACT_VERSION } from '@arqueia/contracts';
import type { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from '../domain/ports/access-token-verifier.port.js';

const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  token_use: z.literal('access'),
  contract_version: z.literal(IDENTITY_CONTRACT_VERSION),
});

export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  public constructor(private readonly jwt: JwtService) {}

  public async verify(accessToken: string): Promise<VerifiedAccessToken | null> {
    try {
      const payload = accessTokenPayloadSchema.parse(await this.jwt.verifyAsync(accessToken));
      return { subject: payload.sub };
    } catch {
      return null;
    }
  }
}
