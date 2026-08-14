import type {
  CreateLaboratoryInput,
  Laboratory,
  UpdateLaboratoryInput,
} from '@arqueia/contracts';

import type { IdentityMutationContext } from './identity-mutation-context.js';

export interface LaboratoryReader {
  listVisibleTo(laboratoryIds: readonly string[] | null): Promise<readonly Laboratory[]>;
}

export interface LaboratoryWriter {
  create(input: CreateLaboratoryInput, context: IdentityMutationContext): Promise<Laboratory>;
  update(
    laboratoryId: string,
    input: UpdateLaboratoryInput,
    context: IdentityMutationContext,
  ): Promise<Laboratory>;
}

export const LABORATORY_READER = Symbol('LABORATORY_READER');
export const LABORATORY_WRITER = Symbol('LABORATORY_WRITER');
