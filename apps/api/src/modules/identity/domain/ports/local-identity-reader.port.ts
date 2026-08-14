import type { AuthenticatedPrincipal } from '@arqueia/contracts';

export interface LocalIdentityAccount {
  readonly principal: AuthenticatedPrincipal;
  readonly passwordHash: string;
}

export interface LocalIdentityReader {
  findActiveByEmail(email: string): Promise<LocalIdentityAccount | null>;
}

export const LOCAL_IDENTITY_READER = Symbol('LOCAL_IDENTITY_READER');
