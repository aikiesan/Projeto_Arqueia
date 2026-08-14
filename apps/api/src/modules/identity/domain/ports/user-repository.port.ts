import type { CreateUserInput, UpdateUserInput, User } from '@arqueia/contracts';

import type { IdentityMutationContext } from './identity-mutation-context.js';

export interface UserReader {
  listVisibleTo(laboratoryIds: readonly string[] | null): Promise<readonly User[]>;
}

export type CreateUserRecord = Omit<CreateUserInput, 'temporaryPassword'>;

export interface UserWriter {
  create(
    input: CreateUserRecord,
    passwordHash: string | null,
    context: IdentityMutationContext,
  ): Promise<User>;
  update(
    userId: string,
    input: UpdateUserInput,
    context: IdentityMutationContext,
  ): Promise<User>;
}

export const USER_READER = Symbol('USER_READER');
export const USER_WRITER = Symbol('USER_WRITER');
