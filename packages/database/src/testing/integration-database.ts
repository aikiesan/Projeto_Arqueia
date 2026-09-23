import { createDatabasePool, type DatabaseConfig, type DatabasePool } from '../client.js';

/**
 * Guarda das suítes de integração que escrevem no banco.
 *
 * Elas inserem linhas de verdade, inclusive em `stock_movements` e
 * `audit_events`, que são append-only e recusam DELETE: o que gravam não sai
 * mais. Antes bastava existir `DATABASE_URL`, e o `.env` da VM define essa
 * variável apontando para produção. O guarda troca "existe um banco" por
 * "existe um banco descartável", reconhecido pelo sufixo `_test` (a CI usa
 * `arqueia_test`). Ver `docs/plan/INTEGRATION-TEST-DATABASE-GUARD.md`.
 */

export const INTEGRATION_DATABASE_SUFFIX = '_test';

export type IntegrationDatabase =
  | { readonly enabled: true; readonly connectionString: string; readonly databaseName: string }
  | { readonly enabled: false; readonly reason: string };

export type DatabasePoolFactory = (config: DatabaseConfig) => DatabasePool;

/** Decide, na coleta dos testes, se as suítes de integração podem rodar. */
export function resolveIntegrationDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): IntegrationDatabase {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) return refuse('DATABASE_URL não definida.');

  const url = parsePostgresUrl(connectionString);
  if (url === undefined) return refuse('DATABASE_URL não é uma URL postgres:// legível.');

  const databaseName = databaseNameOf(url);
  if (databaseName === undefined) {
    return refuse('DATABASE_URL não nomeia o banco (caminho da URL vazio ou ilegível).');
  }
  if (!isIntegrationDatabaseName(databaseName)) {
    return refuse(`O banco "${databaseName}" não termina em ${INTEGRATION_DATABASE_SUFFIX}.`);
  }

  return { enabled: true, connectionString, databaseName };
}

/**
 * Abre o pool das suítes de integração só depois de o servidor confirmar o banco.
 *
 * O nome lido da URL é uma interpretação nossa; quem escolhe o banco é o
 * Postgres (um pooler pode apelidar bancos, por exemplo). E o Vitest roda o
 * `afterAll` mesmo quando o `beforeAll` falha: se a suíte recebesse o pool antes
 * da conferência, a limpeza do `afterAll` rodaria no banco recusado. Por isso o
 * pool só sai daqui conferido; recusado, ele é fechado antes de a promessa
 * rejeitar.
 */
export async function connectIntegrationDatabase(
  database: IntegrationDatabase,
  maxConnections: number,
  createPool: DatabasePoolFactory = createDatabasePool,
): Promise<DatabasePool> {
  if (!database.enabled) throw new Error(`Suíte de integração recusada: ${database.reason}`);

  const pool = createPool({ connectionString: database.connectionString, maxConnections });
  try {
    const result = await pool.query<{ name: string }>('SELECT current_database() AS name');
    const connectedTo = result.rows[0]?.name;
    if (connectedTo === undefined || !isIntegrationDatabaseName(connectedTo)) {
      throw new Error(
        `Suíte de integração recusada: a URL nomeia "${database.databaseName}", ` +
          `mas o servidor conectou em "${connectedTo ?? '?'}".`,
      );
    }
    return pool;
  } catch (error) {
    // Um erro ao fechar não pode esconder o motivo da recusa.
    await pool.end().catch(() => undefined);
    throw error;
  }
}

function isIntegrationDatabaseName(name: string): boolean {
  return name.endsWith(INTEGRATION_DATABASE_SUFFIX);
}

function refuse(reason: string): IntegrationDatabase {
  return { enabled: false, reason };
}

function parsePostgresUrl(connectionString: string): URL | undefined {
  try {
    const url = new URL(connectionString);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Mesmo recorte do `pg-connection-string`: o caminho sem a barra inicial, via
 * `decodeURI`. Query e fragmento não entram, então `?application_name=x_test`
 * não torna `arqueia` descartável.
 */
function databaseNameOf(url: URL): string | undefined {
  try {
    const name = decodeURI(url.pathname.slice(1));
    return name.length > 0 ? name : undefined;
  } catch {
    // Escape malformado: o próprio pg falharia ao decodificar.
    return undefined;
  }
}
