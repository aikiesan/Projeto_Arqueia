import pg from 'pg';

const { Pool } = pg;

export type DatabasePool = pg.Pool;
export type DatabaseClient = pg.PoolClient;

export interface DatabaseConfig {
  readonly connectionString: string;
  readonly maxConnections?: number;
}

export function createDatabasePool(config: DatabaseConfig): DatabasePool {
  return new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 10,
    application_name: 'arqueia',
  });
}

export async function inTransaction<T>(
  pool: DatabasePool,
  operation: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
