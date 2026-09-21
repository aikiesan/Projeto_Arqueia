import { resolve } from 'node:path';

import { createDatabasePool, type DatabasePool } from '../client.js';

/**
 * Peças comuns às CLIs de operação da VM.
 *
 * Cada script é uma casca fina: o miolo é função pura, testável sem banco, e o
 * runtime só cuida de argumentos, conexão e código de saída.
 */

export interface CliFlags {
  readonly positional: readonly string[];
  readonly options: Readonly<Record<string, string>>;
}

/** Aceita `--chave=valor`, `--chave valor` e `--sinalizador`. */
export function parseArgs(argv: readonly string[]): CliFlags {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }

    const body = argument.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) {
      options[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[body] = next;
      index += 1;
    } else {
      options[body] = 'true';
    }
  }

  return { options, positional };
}

export function requireDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const url = environment.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL não definida. Rode a partir de /data/arqueia/repo.');
  return url;
}

export async function withPool<T>(
  operation: (pool: DatabasePool) => Promise<T>,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const pool = createDatabasePool({
    connectionString: requireDatabaseUrl(environment),
    maxConnections: 1,
  });
  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

/** `true` quando o módulo foi chamado diretamente, e não importado por um teste. */
export function isDirectExecution(moduleUrl: string): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) return false;
  return resolve(invokedPath) === resolve(new URL(moduleUrl).pathname);
}

export function runCli(label: string, main: () => Promise<string | void>): void {
  main()
    .then((summary) => {
      if (summary) console.info(`[${label}] ${summary}`);
    })
    .catch((error: unknown) => {
      console.error(`[${label}] ${error instanceof Error ? error.message : 'falha desconhecida'}`);
      process.exitCode = 1;
    });
}
