import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Algorithm, hash } from '@node-rs/argon2';
import { institutionalEmailSchema } from '@arqueia/contracts';

import {
  createDatabasePool,
  inTransaction,
  type DatabaseClient,
  type DatabaseConfig,
  type DatabasePool,
} from './client.js';

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 128;

export interface BootstrapAdminEnvironment {
  readonly DATABASE_URL?: string;
  readonly BOOTSTRAP_ADMIN_NAME?: string;
  readonly BOOTSTRAP_ADMIN_EMAIL?: string;
  readonly BOOTSTRAP_ADMIN_PASSWORD?: string;
  readonly BOOTSTRAP_INSTITUTION_NAME?: string;
  readonly BOOTSTRAP_INSTITUTION_ACRONYM?: string;
  readonly BOOTSTRAP_LAB_NAME?: string;
  readonly BOOTSTRAP_LAB_CODE?: string;
  readonly BOOTSTRAP_LAB_TIMEZONE?: string;
}

export interface BootstrapAdminConfig {
  readonly databaseUrl: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly institutionName: string;
  readonly institutionAcronym: string;
  readonly laboratoryName: string;
  readonly laboratoryCode: string;
  readonly laboratoryTimezone: string;
}

export interface BootstrapAdminResult {
  readonly administratorId: string;
  readonly institutionId: string;
  readonly laboratoryId: string;
  readonly email: string;
}

export interface BootstrapAdminDependencies {
  readonly createPool?: (config: DatabaseConfig) => DatabasePool;
  readonly hashPassword?: (password: string) => Promise<string>;
}

interface IdRow {
  readonly id: string;
}

function requiredTrimmed(value: string | undefined, label: string, minimum: number, maximum: number) {
  const normalized = value?.trim() ?? '';
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${label} deve ter entre ${minimum} e ${maximum} caracteres.`);
  }
  return normalized;
}

export function validateBootstrapAdminEnvironment(
  environment: BootstrapAdminEnvironment,
): BootstrapAdminConfig {
  const databaseUrl = requiredTrimmed(environment.DATABASE_URL, 'DATABASE_URL', 1, 2_048);
  const name = requiredTrimmed(environment.BOOTSTRAP_ADMIN_NAME, 'BOOTSTRAP_ADMIN_NAME', 2, 120);
  const email = institutionalEmailSchema.parse(environment.BOOTSTRAP_ADMIN_EMAIL);
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (password.length < MINIMUM_PASSWORD_LENGTH || password.length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `BOOTSTRAP_ADMIN_PASSWORD deve ter entre ${MINIMUM_PASSWORD_LENGTH} e ${MAXIMUM_PASSWORD_LENGTH} caracteres.`,
    );
  }

  return {
    databaseUrl,
    name,
    email,
    password,
    institutionName: requiredTrimmed(
      environment.BOOTSTRAP_INSTITUTION_NAME ?? 'Universidade Estadual de Campinas',
      'BOOTSTRAP_INSTITUTION_NAME',
      2,
      160,
    ),
    institutionAcronym: requiredTrimmed(
      environment.BOOTSTRAP_INSTITUTION_ACRONYM ?? 'UNICAMP',
      'BOOTSTRAP_INSTITUTION_ACRONYM',
      2,
      24,
    ),
    laboratoryName: requiredTrimmed(
      environment.BOOTSTRAP_LAB_NAME ?? 'Laboratório CP2b',
      'BOOTSTRAP_LAB_NAME',
      2,
      160,
    ),
    laboratoryCode: requiredTrimmed(
      environment.BOOTSTRAP_LAB_CODE ?? 'CP2b',
      'BOOTSTRAP_LAB_CODE',
      2,
      32,
    ),
    laboratoryTimezone: requiredTrimmed(
      environment.BOOTSTRAP_LAB_TIMEZONE ?? 'America/Sao_Paulo',
      'BOOTSTRAP_LAB_TIMEZONE',
      2,
      64,
    ),
  };
}

async function requireId(
  client: DatabaseClient,
  statement: string,
  parameters: readonly unknown[],
  entity: string,
): Promise<string> {
  const result = await client.query<IdRow>(statement, [...parameters]);
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Não foi possível criar ou localizar ${entity}.`);
  return row.id;
}

export async function bootstrapFirstAdministrator(
  pool: DatabasePool,
  config: BootstrapAdminConfig,
  hashPassword: (password: string) => Promise<string> = (password) =>
    hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    }),
): Promise<BootstrapAdminResult> {
  return inTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('arqueia.bootstrap-admin'))");
    const existingAdmin = await client.query<{ readonly exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM system_role_assignments
          WHERE role = 'ADMIN' AND archived_at IS NULL
       ) AS exists`,
    );
    if (existingAdmin.rows[0]?.exists === true) {
      throw new Error('Já existe um administrador ativo. Use a interface de gestão de usuários.');
    }

    const institutionId = await requireId(
      client,
      `INSERT INTO institutions (name, acronym)
       VALUES ($1, $2)
       ON CONFLICT (acronym) WHERE archived_at IS NULL
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [config.institutionName, config.institutionAcronym],
      'a instituição',
    );
    const laboratoryId = await requireId(
      client,
      `INSERT INTO laboratories (institution_id, name, code, timezone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (institution_id, code) WHERE archived_at IS NULL
       DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone
       RETURNING id`,
      [institutionId, config.laboratoryName, config.laboratoryCode, config.laboratoryTimezone],
      'o laboratório',
    );
    const administratorId = await requireId(
      client,
      `INSERT INTO users (
         institution_id, login_code, name, email, academic_category, status, must_change_password
       ) VALUES (
         $1, 'ARQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
         $2, $3, 'PESQUISADOR', 'ACTIVE', false
       ) RETURNING id`,
      [institutionId, config.name, config.email],
      'o administrador',
    );
    const passwordHash = await hashPassword(config.password);
    await client.query(
      'INSERT INTO local_credentials (user_id, password_hash) VALUES ($1, $2)',
      [administratorId, passwordHash],
    );
    const assignmentId = await requireId(
      client,
      `INSERT INTO system_role_assignments (user_id, role)
       VALUES ($1, 'ADMIN') RETURNING id`,
      [administratorId],
      'a atribuição ADMIN',
    );
    await client.query(
      `INSERT INTO audit_events (
         actor_id, laboratory_id, action, entity, entity_id, before, after, origin
       ) VALUES (
         $1, $2, 'identity.bootstrap.admin.created', 'SystemRoleAssignment', $3,
         NULL, $4::jsonb, 'bootstrap-admin-cli'
       )`,
      [
        administratorId,
        laboratoryId,
        assignmentId,
        JSON.stringify({ userId: administratorId, role: 'ADMIN', email: config.email }),
      ],
    );

    return { administratorId, institutionId, laboratoryId, email: config.email };
  });
}

export async function runBootstrapAdmin(
  environment: BootstrapAdminEnvironment = process.env,
  dependencies: BootstrapAdminDependencies = {},
): Promise<BootstrapAdminResult> {
  const config = validateBootstrapAdminEnvironment(environment);
  const pool = (dependencies.createPool ?? createDatabasePool)({
    connectionString: config.databaseUrl,
    maxConnections: 1,
  });
  try {
    return await bootstrapFirstAdministrator(pool, config, dependencies.hashPassword);
  } finally {
    await pool.end();
  }
}

const invokedPath = process.argv[1];
const isDirectExecution =
  invokedPath !== undefined && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runBootstrapAdmin()
    .then((result) => {
      console.info(`[database:bootstrap-admin] administrador criado: ${result.email}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'falha desconhecida';
      console.error(`[database:bootstrap-admin] falhou: ${message}`);
      process.exitCode = 1;
    });
}
