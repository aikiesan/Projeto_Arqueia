import type { AuthenticatedPrincipal } from '@arqueia/contracts';

export interface PrincipalReader {
  findByUserId(userId: string): Promise<AuthenticatedPrincipal | null>;
}

export const PRINCIPAL_READER = Symbol('PRINCIPAL_READER');
