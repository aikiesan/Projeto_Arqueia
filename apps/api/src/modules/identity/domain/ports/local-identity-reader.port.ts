import type { AuthenticatedPrincipal } from '@arqueia/contracts';

export interface LocalIdentityAccount {
  readonly principal: AuthenticatedPrincipal;
  readonly passwordHash: string;
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
}

export interface LocalIdentityReader {
  findActiveByEmail(email: string): Promise<LocalIdentityAccount | null>;
  findActiveById(userId: string): Promise<LocalIdentityAccount | null>;
  recordLoginSuccess(userId: string): Promise<void>;
  recordLoginFailure(
    userId: string,
    maxFailedAttempts: number,
    lockoutDurationSeconds: number,
  ): Promise<{ failedAttempts: number; isLocked: boolean; lockedUntil: string | null }>;
}

export const LOCAL_IDENTITY_READER = Symbol('LOCAL_IDENTITY_READER');
