export interface CurrentCredential {
  readonly passwordHash: string;
}

export interface CurrentCredentialReader {
  findActiveByUserId(userId: string): Promise<CurrentCredential | null>;
}

export const CURRENT_CREDENTIAL_READER = Symbol('CURRENT_CREDENTIAL_READER');
