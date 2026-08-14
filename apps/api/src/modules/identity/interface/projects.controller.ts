import {
  createProjectInputSchema,
  type AuthenticatedPrincipal,
  type CreateProjectInput,
  type Project,
  projectParamsSchema,
  type UpdateProjectInput,
  updateProjectInputSchema,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { CreateProjectUseCase } from '../application/create-project.use-case.js';
import { ListProjectsUseCase } from '../application/list-projects.use-case.js';
import { UpdateProjectUseCase } from '../application/update-project.use-case.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { IdentityExceptionFilter } from './identity-exception.filter.js';
import { identityRequestContext } from './identity-request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type ProjectParams = z.output<typeof projectParamsSchema>;

@Controller('api/projects')
@UseGuards(JwtAuthGuard)
@UseFilters(IdentityExceptionFilter)
export class ProjectsController {
  public constructor(
    @Inject(ListProjectsUseCase) private readonly listProjects: ListProjectsUseCase,
    @Inject(CreateProjectUseCase) private readonly createProject: CreateProjectUseCase,
    @Inject(UpdateProjectUseCase) private readonly updateProject: UpdateProjectUseCase,
  ) {}

  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<readonly Project[]> {
    return this.listProjects.execute(principal);
  }

  @Post()
  public create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(createProjectInputSchema)) input: CreateProjectInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Project> {
    return this.createProject.execute(principal, input, identityRequestContext(requestId));
  }

  @Patch(':projectId')
  public update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(projectParamsSchema)) params: ProjectParams,
    @Body(new ZodValidationPipe(updateProjectInputSchema)) input: UpdateProjectInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Project> {
    return this.updateProject.execute(
      principal,
      params.projectId,
      input,
      identityRequestContext(requestId),
    );
  }
}
