import type { CreateProjectInput, Project, UpdateProjectInput } from '@arqueia/contracts';

import type { IdentityMutationContext } from './identity-mutation-context.js';

export interface ProjectReader {
  listVisibleTo(laboratoryIds: readonly string[] | null): Promise<readonly Project[]>;
  findActiveById(projectId: string): Promise<Project | null>;
}

export interface ProjectWriter {
  create(input: CreateProjectInput, context: IdentityMutationContext): Promise<Project>;
  update(
    projectId: string,
    input: UpdateProjectInput,
    context: IdentityMutationContext,
  ): Promise<Project>;
}

export const PROJECT_READER = Symbol('PROJECT_READER');
export const PROJECT_WRITER = Symbol('PROJECT_WRITER');
