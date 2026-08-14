import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AssignMembershipUseCase } from './application/assign-membership.use-case.js';
import { AssignSystemRoleUseCase } from './application/assign-system-role.use-case.js';
import { CreateLaboratoryUseCase } from './application/create-laboratory.use-case.js';
import { CreateProjectUseCase } from './application/create-project.use-case.js';
import { CreateUserUseCase } from './application/create-user.use-case.js';
import { GetUserAccessUseCase } from './application/get-user-access.use-case.js';
import { RevokeMembershipUseCase } from './application/revoke-membership.use-case.js';
import { RevokeSystemRoleUseCase } from './application/revoke-system-role.use-case.js';
import { ListLaboratoriesUseCase } from './application/list-laboratories.use-case.js';
import { ListProjectsUseCase } from './application/list-projects.use-case.js';
import { ListUsersUseCase } from './application/list-users.use-case.js';
import { LoginLocalUseCase } from './application/login-local.use-case.js';
import { UpdateLaboratoryUseCase } from './application/update-laboratory.use-case.js';
import { UpdateProjectUseCase } from './application/update-project.use-case.js';
import { UpdateUserUseCase } from './application/update-user.use-case.js';
import { ACCESS_TOKEN_ISSUER } from './domain/ports/access-token-issuer.port.js';
import { ACCESS_TOKEN_VERIFIER } from './domain/ports/access-token-verifier.port.js';
import { AUDIT_EVENT_WRITER } from './domain/ports/audit-event-writer.port.js';
import { LOCAL_IDENTITY_READER } from './domain/ports/local-identity-reader.port.js';
import {
  LABORATORY_READER,
  LABORATORY_WRITER,
} from './domain/ports/laboratory-repository.port.js';
import {
  MEMBERSHIP_WRITER,
  MEMBERSHIP_READER,
  SYSTEM_ROLE_READER,
  SYSTEM_ROLE_WRITER,
} from './domain/ports/membership-repository.port.js';
import { OIDC_PROVIDER } from './domain/ports/oidc-provider.port.js';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port.js';
import { PASSWORD_VERIFIER } from './domain/ports/password-verifier.port.js';
import { PRINCIPAL_READER } from './domain/ports/principal-reader.port.js';
import { PROJECT_READER, PROJECT_WRITER } from './domain/ports/project-repository.port.js';
import { USER_READER, USER_WRITER } from './domain/ports/user-repository.port.js';
import { PermissionEvaluator } from './domain/services/permission-evaluator.js';
import { ReauthenticationService } from './domain/services/reauthentication.js';
import {
  Argon2PasswordHasher,
  Argon2PasswordVerifier,
} from './infrastructure/argon2-password-verifier.js';
import { ConfiguredOidcProvider } from './infrastructure/configured-oidc-provider.js';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token-issuer.js';
import { JwtAccessTokenVerifier } from './infrastructure/jwt-access-token-verifier.js';
import { PostgresAuditEventWriter } from './infrastructure/postgres-audit-event-writer.js';
import { PostgresLocalIdentityReader } from './infrastructure/postgres-local-identity-reader.js';
import { PostgresLaboratoryRepository } from './infrastructure/postgres-laboratory-repository.js';
import {
  PostgresMembershipRepository,
  PostgresSystemRoleRepository,
} from './infrastructure/postgres-membership-repository.js';
import { PostgresProjectRepository } from './infrastructure/postgres-project-repository.js';
import { PostgresUserRepository } from './infrastructure/postgres-user-repository.js';
import { AccessController } from './interface/access.controller.js';
import { AuthController } from './interface/auth.controller.js';
import { LaboratoriesController } from './interface/laboratories.controller.js';
import { JwtAuthGuard } from './interface/jwt-auth.guard.js';
import { ProjectsController } from './interface/projects.controller.js';
import { UsersController } from './interface/users.controller.js';
import { loadApiEnvironment } from '../../configuration.js';
import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';

const POSTGRES_IDENTITY_READER = Symbol('POSTGRES_IDENTITY_READER');
const POSTGRES_USER_REPOSITORY = Symbol('POSTGRES_USER_REPOSITORY');
const POSTGRES_LABORATORY_REPOSITORY = Symbol('POSTGRES_LABORATORY_REPOSITORY');
const POSTGRES_PROJECT_REPOSITORY = Symbol('POSTGRES_PROJECT_REPOSITORY');
const POSTGRES_MEMBERSHIP_REPOSITORY = Symbol('POSTGRES_MEMBERSHIP_REPOSITORY');
const POSTGRES_SYSTEM_ROLE_REPOSITORY = Symbol('POSTGRES_SYSTEM_ROLE_REPOSITORY');

@Module({
  imports: [DatabaseModule],
  controllers: [
    AuthController,
    UsersController,
    LaboratoriesController,
    ProjectsController,
    AccessController,
  ],
  providers: [
    {
      provide: POSTGRES_IDENTITY_READER,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresLocalIdentityReader(pool),
    },
    {
      provide: LOCAL_IDENTITY_READER,
      inject: [POSTGRES_IDENTITY_READER],
      useFactory: (reader: PostgresLocalIdentityReader) => reader,
    },
    {
      provide: PRINCIPAL_READER,
      inject: [POSTGRES_IDENTITY_READER],
      useFactory: (reader: PostgresLocalIdentityReader) => reader,
    },
    {
      provide: PASSWORD_VERIFIER,
      useFactory: () => new Argon2PasswordVerifier(),
    },
    {
      provide: PASSWORD_HASHER,
      useFactory: () => new Argon2PasswordHasher(),
    },
    {
      provide: JwtService,
      useFactory: () => {
        const environment = loadApiEnvironment();
        return new JwtService({
          secret: environment.JWT_SECRET,
          signOptions: { expiresIn: environment.JWT_ACCESS_TTL_SECONDS },
        });
      },
    },
    {
      provide: ACCESS_TOKEN_ISSUER,
      inject: [JwtService],
      useFactory: (jwt: JwtService) =>
        new JwtAccessTokenIssuer(jwt, loadApiEnvironment().JWT_ACCESS_TTL_SECONDS),
    },
    {
      provide: ACCESS_TOKEN_VERIFIER,
      inject: [JwtService],
      useFactory: (jwt: JwtService) => new JwtAccessTokenVerifier(jwt),
    },
    {
      provide: AUDIT_EVENT_WRITER,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresAuditEventWriter(pool),
    },
    JwtAuthGuard,
    {
      provide: OIDC_PROVIDER,
      useFactory: () => {
        const environment = loadApiEnvironment();
        return new ConfiguredOidcProvider({
          enabled: environment.OIDC_ENABLED,
          displayName: environment.OIDC_DISPLAY_NAME,
          authorizationUrl: environment.OIDC_AUTHORIZATION_URL || null,
        });
      },
    },
    {
      provide: LoginLocalUseCase,
      inject: [
        LOCAL_IDENTITY_READER,
        PASSWORD_VERIFIER,
        ACCESS_TOKEN_ISSUER,
        AUDIT_EVENT_WRITER,
      ],
      useFactory: (...dependencies: ConstructorParameters<typeof LoginLocalUseCase>) =>
        new LoginLocalUseCase(...dependencies),
    },
    PermissionEvaluator,
    {
      provide: POSTGRES_USER_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresUserRepository(pool),
    },
    {
      provide: USER_READER,
      inject: [POSTGRES_USER_REPOSITORY],
      useFactory: (repository: PostgresUserRepository) => repository,
    },
    {
      provide: USER_WRITER,
      inject: [POSTGRES_USER_REPOSITORY],
      useFactory: (repository: PostgresUserRepository) => repository,
    },
    {
      provide: POSTGRES_LABORATORY_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresLaboratoryRepository(pool),
    },
    {
      provide: LABORATORY_READER,
      inject: [POSTGRES_LABORATORY_REPOSITORY],
      useFactory: (repository: PostgresLaboratoryRepository) => repository,
    },
    {
      provide: LABORATORY_WRITER,
      inject: [POSTGRES_LABORATORY_REPOSITORY],
      useFactory: (repository: PostgresLaboratoryRepository) => repository,
    },
    {
      provide: POSTGRES_PROJECT_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresProjectRepository(pool),
    },
    {
      provide: PROJECT_READER,
      inject: [POSTGRES_PROJECT_REPOSITORY],
      useFactory: (repository: PostgresProjectRepository) => repository,
    },
    {
      provide: PROJECT_WRITER,
      inject: [POSTGRES_PROJECT_REPOSITORY],
      useFactory: (repository: PostgresProjectRepository) => repository,
    },
    {
      provide: ListUsersUseCase,
      inject: [USER_READER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof ListUsersUseCase>) =>
        new ListUsersUseCase(...dependencies),
    },
    {
      provide: CreateUserUseCase,
      inject: [USER_WRITER, PASSWORD_HASHER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof CreateUserUseCase>) =>
        new CreateUserUseCase(...dependencies),
    },
    {
      provide: UpdateUserUseCase,
      inject: [USER_WRITER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof UpdateUserUseCase>) =>
        new UpdateUserUseCase(...dependencies),
    },
    {
      provide: ListLaboratoriesUseCase,
      inject: [LABORATORY_READER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof ListLaboratoriesUseCase>) =>
        new ListLaboratoriesUseCase(...dependencies),
    },
    {
      provide: CreateLaboratoryUseCase,
      inject: [LABORATORY_WRITER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof CreateLaboratoryUseCase>) =>
        new CreateLaboratoryUseCase(...dependencies),
    },
    {
      provide: UpdateLaboratoryUseCase,
      inject: [LABORATORY_WRITER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof UpdateLaboratoryUseCase>) =>
        new UpdateLaboratoryUseCase(...dependencies),
    },
    {
      provide: ListProjectsUseCase,
      inject: [PROJECT_READER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof ListProjectsUseCase>) =>
        new ListProjectsUseCase(...dependencies),
    },
    {
      provide: CreateProjectUseCase,
      inject: [PROJECT_WRITER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof CreateProjectUseCase>) =>
        new CreateProjectUseCase(...dependencies),
    },
    {
      provide: UpdateProjectUseCase,
      inject: [PROJECT_READER, PROJECT_WRITER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof UpdateProjectUseCase>) =>
        new UpdateProjectUseCase(...dependencies),
    },
    {
      provide: ReauthenticationService,
      inject: [LOCAL_IDENTITY_READER, PASSWORD_VERIFIER],
      useFactory: (...dependencies: ConstructorParameters<typeof ReauthenticationService>) =>
        new ReauthenticationService(...dependencies),
    },
    {
      provide: POSTGRES_MEMBERSHIP_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresMembershipRepository(pool),
    },
    {
      provide: MEMBERSHIP_WRITER,
      inject: [POSTGRES_MEMBERSHIP_REPOSITORY],
      useFactory: (repository: PostgresMembershipRepository) => repository,
    },
    {
      provide: MEMBERSHIP_READER,
      inject: [POSTGRES_MEMBERSHIP_REPOSITORY],
      useFactory: (repository: PostgresMembershipRepository) => repository,
    },
    {
      provide: POSTGRES_SYSTEM_ROLE_REPOSITORY,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresSystemRoleRepository(pool),
    },
    {
      provide: SYSTEM_ROLE_WRITER,
      inject: [POSTGRES_SYSTEM_ROLE_REPOSITORY],
      useFactory: (repository: PostgresSystemRoleRepository) => repository,
    },
    {
      provide: SYSTEM_ROLE_READER,
      inject: [POSTGRES_SYSTEM_ROLE_REPOSITORY],
      useFactory: (repository: PostgresSystemRoleRepository) => repository,
    },
    {
      provide: GetUserAccessUseCase,
      inject: [MEMBERSHIP_READER, SYSTEM_ROLE_READER, PermissionEvaluator],
      useFactory: (...dependencies: ConstructorParameters<typeof GetUserAccessUseCase>) =>
        new GetUserAccessUseCase(...dependencies),
    },
    {
      provide: AssignMembershipUseCase,
      inject: [MEMBERSHIP_WRITER, PermissionEvaluator, ReauthenticationService],
      useFactory: (...dependencies: ConstructorParameters<typeof AssignMembershipUseCase>) =>
        new AssignMembershipUseCase(...dependencies),
    },
    {
      provide: RevokeMembershipUseCase,
      inject: [MEMBERSHIP_WRITER, PermissionEvaluator, ReauthenticationService],
      useFactory: (...dependencies: ConstructorParameters<typeof RevokeMembershipUseCase>) =>
        new RevokeMembershipUseCase(...dependencies),
    },
    {
      provide: AssignSystemRoleUseCase,
      inject: [SYSTEM_ROLE_WRITER, PermissionEvaluator, ReauthenticationService],
      useFactory: (...dependencies: ConstructorParameters<typeof AssignSystemRoleUseCase>) =>
        new AssignSystemRoleUseCase(...dependencies),
    },
    {
      provide: RevokeSystemRoleUseCase,
      inject: [SYSTEM_ROLE_WRITER, PermissionEvaluator, ReauthenticationService],
      useFactory: (...dependencies: ConstructorParameters<typeof RevokeSystemRoleUseCase>) =>
        new RevokeSystemRoleUseCase(...dependencies),
    },
  ],
  exports: [JwtAuthGuard, ACCESS_TOKEN_VERIFIER, PRINCIPAL_READER, PermissionEvaluator],
})
export class IdentityModule {}
