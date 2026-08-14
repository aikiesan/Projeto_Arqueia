import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Algorithm, hash } from '@node-rs/argon2';

import {
  createDatabasePool,
  inTransaction,
  type DatabaseClient,
  type DatabaseConfig,
  type DatabasePool,
} from './client.js';
import { seedCP2bReferenceCatalog, type CP2bCatalogSeedResult } from './reference-data/seed-cp2b-catalog.js';

const MINIMUM_ADMIN_PASSWORD_LENGTH = 12;

export const DEVELOPMENT_SEED = Object.freeze({
  institution: {
    name: 'Universidade Estadual de Campinas',
    acronym: 'UNICAMP',
  },
  laboratory: {
    name: 'Laboratório CP2b',
    code: 'CP2b',
    timezone: 'America/Sao_Paulo',
  },
  project: {
    name: 'Projeto de demonstração CP2b',
    code: 'CP2b-DEMO',
    description: 'Projeto determinístico para desenvolvimento e homologação.',
  },
  administrator: {
    name: 'Administrador Arqueia',
    email: 'admin@arqueia.local',
  },
  systemRole: 'ADMIN',
} as const);

export interface SeedEnvironment {
  readonly NODE_ENV?: string;
  readonly DATABASE_URL?: string;
  readonly DEV_SEED_ADMIN_PASSWORD?: string;
}

export interface SeedConfig {
  readonly databaseUrl: string;
  readonly administratorPassword: string;
}

export interface SeedResult {
  readonly institutionId: string;
  readonly laboratoryId: string;
  readonly projectId: string;
  readonly administratorId: string;
  readonly credentialCreated: boolean;
  readonly systemRoleAssignmentId: string;
  readonly catalog: CP2bCatalogSeedResult;
}

export type PasswordHasher = (password: string) => Promise<string>;

export interface SeedDependencies {
  readonly createPool?: (config: DatabaseConfig) => DatabasePool;
  readonly hashPassword?: PasswordHasher;
}

interface IdRow {
  readonly id: string;
}

interface RoleAssignmentRow extends IdRow {
  readonly inserted: boolean;
}

export function validateSeedEnvironment(environment: SeedEnvironment): SeedConfig {
  if (environment.NODE_ENV?.toLowerCase() === 'production') {
    throw new Error('O seed de desenvolvimento/homologação é proibido em produção.');
  }

  const administratorPassword = environment.DEV_SEED_ADMIN_PASSWORD;
  if (
    administratorPassword === undefined ||
    administratorPassword.length < MINIMUM_ADMIN_PASSWORD_LENGTH
  ) {
    throw new Error(
      `DEV_SEED_ADMIN_PASSWORD deve ter no mínimo ${MINIMUM_ADMIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const databaseUrl = environment.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL é obrigatória para executar o seed.');
  }

  return { databaseUrl, administratorPassword };
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

async function requireId(
  client: DatabaseClient,
  statement: string,
  parameters: readonly unknown[],
  entity: string,
): Promise<string> {
  const result = await client.query<IdRow>(statement, [...parameters]);
  const row = result.rows[0];

  if (row === undefined) {
    throw new Error(`Não foi possível obter o identificador de ${entity}.`);
  }

  return row.id;
}

export async function seedDevelopmentData(
  pool: DatabasePool,
  administratorPassword: string,
  hashPassword: PasswordHasher = hashAdminPassword,
): Promise<SeedResult> {
  return inTransaction(pool, async (client) => {
    const institutionId = await requireId(
      client,
      `
        WITH seeded AS (
          INSERT INTO institutions (name, acronym)
          VALUES ($1, $2)
          ON CONFLICT (acronym) WHERE archived_at IS NULL
          DO UPDATE SET name = EXCLUDED.name
          WHERE institutions.name IS DISTINCT FROM EXCLUDED.name
          RETURNING id
        )
        SELECT id FROM seeded
        UNION ALL
        SELECT id FROM institutions WHERE acronym = $2 AND archived_at IS NULL
        LIMIT 1
      `,
      [DEVELOPMENT_SEED.institution.name, DEVELOPMENT_SEED.institution.acronym],
      'instituição UNICAMP',
    );

    const laboratoryId = await requireId(
      client,
      `
        WITH seeded AS (
          INSERT INTO laboratories (institution_id, name, code, timezone)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (institution_id, code) WHERE archived_at IS NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            timezone = EXCLUDED.timezone
          WHERE laboratories.name IS DISTINCT FROM EXCLUDED.name
             OR laboratories.timezone IS DISTINCT FROM EXCLUDED.timezone
          RETURNING id
        )
        SELECT id FROM seeded
        UNION ALL
        SELECT id
        FROM laboratories
        WHERE institution_id = $1 AND code = $3 AND archived_at IS NULL
        LIMIT 1
      `,
      [
        institutionId,
        DEVELOPMENT_SEED.laboratory.name,
        DEVELOPMENT_SEED.laboratory.code,
        DEVELOPMENT_SEED.laboratory.timezone,
      ],
      'laboratório CP2b',
    );

    const projectId = await requireId(
      client,
      `
        WITH seeded AS (
          INSERT INTO projects (laboratory_id, code, name, description, status)
          VALUES ($1, $2, $3, $4, 'ACTIVE')
          ON CONFLICT (laboratory_id, code) WHERE archived_at IS NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status
          WHERE projects.name IS DISTINCT FROM EXCLUDED.name
             OR projects.description IS DISTINCT FROM EXCLUDED.description
             OR projects.status IS DISTINCT FROM EXCLUDED.status
          RETURNING id
        )
        SELECT id FROM seeded
        UNION ALL
        SELECT id
        FROM projects
        WHERE laboratory_id = $1 AND code = $2 AND archived_at IS NULL
        LIMIT 1
      `,
      [
        laboratoryId,
        DEVELOPMENT_SEED.project.code,
        DEVELOPMENT_SEED.project.name,
        DEVELOPMENT_SEED.project.description,
      ],
      'projeto CP2b-DEMO',
    );

    const administratorId = await requireId(
      client,
      `
        WITH seeded AS (
          INSERT INTO users (institution_id, name, email, status, identity_provider)
          VALUES ($1, $2, $3, 'ACTIVE', 'LOCAL')
          ON CONFLICT (lower(email)) WHERE archived_at IS NULL
          DO UPDATE SET
            institution_id = EXCLUDED.institution_id,
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            identity_provider = EXCLUDED.identity_provider
          WHERE users.institution_id IS DISTINCT FROM EXCLUDED.institution_id
             OR users.name IS DISTINCT FROM EXCLUDED.name
             OR users.status IS DISTINCT FROM EXCLUDED.status
             OR users.identity_provider IS DISTINCT FROM EXCLUDED.identity_provider
          RETURNING id
        )
        SELECT id FROM seeded
        UNION ALL
        SELECT id FROM users WHERE lower(email) = lower($3) AND archived_at IS NULL
        LIMIT 1
      `,
      [
        institutionId,
        DEVELOPMENT_SEED.administrator.name,
        DEVELOPMENT_SEED.administrator.email,
      ],
      'usuário administrador local',
    );

    const credential = await client.query<{ readonly user_id: string }>(
      'SELECT user_id FROM local_credentials WHERE user_id = $1',
      [administratorId],
    );
    const credentialCreated = credential.rowCount === 0;

    if (credentialCreated) {
      const passwordHash = await hashPassword(administratorPassword);
      await client.query(
        `
          INSERT INTO local_credentials (user_id, password_hash)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [administratorId, passwordHash],
      );
    }

    const assignment = await client.query<RoleAssignmentRow>(
      `
        WITH seeded AS (
          INSERT INTO system_role_assignments (user_id, role)
          VALUES ($1, 'ADMIN')
          ON CONFLICT (user_id, role) WHERE archived_at IS NULL
          DO NOTHING
          RETURNING id, true AS inserted
        )
        SELECT id, inserted FROM seeded
        UNION ALL
        SELECT id, false AS inserted
        FROM system_role_assignments
        WHERE user_id = $1 AND role = 'ADMIN' AND archived_at IS NULL
        LIMIT 1
      `,
      [administratorId],
    );
    const roleAssignment = assignment.rows[0];

    if (roleAssignment === undefined) {
      throw new Error('Não foi possível obter a atribuição do papel ADMIN.');
    }

    if (roleAssignment.inserted) {
      await client.query(
        `
          INSERT INTO audit_events (
            actor_id,
            laboratory_id,
            action,
            entity,
            entity_id,
            before,
            after,
            origin
          )
          VALUES ($1, $2, 'identity.system_role.assigned', 'SystemRoleAssignment', $3, NULL, $4::jsonb, 'database-seed')
        `,
        [
          administratorId,
          laboratoryId,
          roleAssignment.id,
          JSON.stringify({ role: DEVELOPMENT_SEED.systemRole, userId: administratorId }),
        ],
      );
    }

    const catalog = await seedCP2bReferenceCatalog(client, laboratoryId, administratorId);

    return {
      institutionId,
      laboratoryId,
      projectId,
      administratorId,
      credentialCreated,
      systemRoleAssignmentId: roleAssignment.id,
      catalog,
    };
  });
}

export async function runSeed(
  environment: SeedEnvironment = process.env,
  dependencies: SeedDependencies = {},
): Promise<SeedResult> {
  const config = validateSeedEnvironment(environment);
  const pool = (dependencies.createPool ?? createDatabasePool)({
    connectionString: config.databaseUrl,
    maxConnections: 1,
  });

  try {
    return await seedDevelopmentData(
      pool,
      config.administratorPassword,
      dependencies.hashPassword ?? hashAdminPassword,
    );
  } finally {
    await pool.end();
  }
}

const invokedPath = process.argv[1];
const isDirectExecution =
  invokedPath !== undefined && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runSeed()
    .then(() => {
      console.info('[database:seed] seed concluído.');
    })
    .catch(() => {
      console.error('[database:seed] seed falhou; nenhum segredo foi exibido.');
      process.exitCode = 1;
    });
}
