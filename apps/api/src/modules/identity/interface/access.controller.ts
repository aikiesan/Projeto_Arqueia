import {
  assignMembershipRequestSchema,
  assignSystemRoleRequestSchema,
  membershipParamsSchema,
  revokeAccessRequestSchema,
  systemRoleAssignmentParamsSchema,
  userAccessQuerySchema,
  type AssignMembershipRequest,
  type AssignSystemRoleRequest,
  type AuthenticatedPrincipal,
  type Membership,
  type RevokeAccessRequest,
  type SystemRoleAssignment,
  type UserAccessSnapshot,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { AssignMembershipUseCase } from '../application/assign-membership.use-case.js';
import { AssignSystemRoleUseCase } from '../application/assign-system-role.use-case.js';
import { GetUserAccessUseCase } from '../application/get-user-access.use-case.js';
import { RevokeMembershipUseCase } from '../application/revoke-membership.use-case.js';
import { RevokeSystemRoleUseCase } from '../application/revoke-system-role.use-case.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import { IdentityExceptionFilter } from './identity-exception.filter.js';
import { identityRequestContext } from './identity-request-context.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type MembershipParams = z.output<typeof membershipParamsSchema>;
type SystemRoleAssignmentParams = z.output<typeof systemRoleAssignmentParamsSchema>;
type UserAccessQuery = z.output<typeof userAccessQuerySchema>;

@Controller('api/access')
@UseGuards(JwtAuthGuard)
@UseFilters(IdentityExceptionFilter)
export class AccessController {
  public constructor(
    @Inject(AssignMembershipUseCase) private readonly assignMembership: AssignMembershipUseCase,
    @Inject(RevokeMembershipUseCase) private readonly revokeMembership: RevokeMembershipUseCase,
    @Inject(AssignSystemRoleUseCase) private readonly assignSystemRole: AssignSystemRoleUseCase,
    @Inject(RevokeSystemRoleUseCase) private readonly revokeSystemRole: RevokeSystemRoleUseCase,
    @Inject(GetUserAccessUseCase) private readonly getUserAccess: GetUserAccessUseCase,
  ) {}

  @Get()
  public listUserAccess(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(userAccessQuerySchema)) query: UserAccessQuery,
  ): Promise<UserAccessSnapshot> {
    return this.getUserAccess.execute(principal, query.userId);
  }

  @Post('memberships')
  public assignMembershipRole(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(assignMembershipRequestSchema)) input: AssignMembershipRequest,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Membership> {
    return this.assignMembership.execute(principal, input, identityRequestContext(requestId));
  }

  @Delete('memberships/:membershipId')
  public revokeMembershipRole(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(membershipParamsSchema)) params: MembershipParams,
    @Body(new ZodValidationPipe(revokeAccessRequestSchema)) input: RevokeAccessRequest,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Membership> {
    return this.revokeMembership.execute(
      principal,
      params.membershipId,
      input,
      identityRequestContext(requestId),
    );
  }

  @Post('system-roles')
  public assignSystemRoleAssignment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(assignSystemRoleRequestSchema)) input: AssignSystemRoleRequest,
    @Headers('x-request-id') requestId?: string,
  ): Promise<SystemRoleAssignment> {
    return this.assignSystemRole.execute(principal, input, identityRequestContext(requestId));
  }

  @Delete('system-roles/:assignmentId')
  public revokeSystemRoleAssignment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(systemRoleAssignmentParamsSchema))
    params: SystemRoleAssignmentParams,
    @Body(new ZodValidationPipe(revokeAccessRequestSchema)) input: RevokeAccessRequest,
    @Headers('x-request-id') requestId?: string,
  ): Promise<SystemRoleAssignment> {
    return this.revokeSystemRole.execute(
      principal,
      params.assignmentId,
      input,
      identityRequestContext(requestId),
    );
  }
}
