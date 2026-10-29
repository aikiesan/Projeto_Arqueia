import { Algorithm, hash } from '@node-rs/argon2';

import { inTransaction, type DatabaseClient, type DatabasePool } from '../client.js';
import { isDirectExecution, parseArgs, runCli, withPool } from './cli-runtime.js';

/**
 * Redefinição de senha pela linha de comando, com acesso ao banco.
 *
 * Existe para a saída de emergência: ninguém consegue entrar, o SMTP não está
 * configurado, e por isso o fluxo de "esqueci minha senha" não fecha sozinho.
 * Não é atalho de operação — quem tem conta usa `/esqueci-senha`, e quem é
 * administrador redefine a senha de outra pessoa pela tela de usuários.
 *
 * Grava auditoria como qualquer troca de senha (AGENTS.md §4.4), com
 * `origin = 'cli:password-set'` para que a trilha mostre que veio do console
 * da VM, e não da aplicação.
 */

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 128;

export interface PasswordSetRequest {
  readonly email: string;
  readonly password: string;
}

export function parsePasswordSetRequest(
  options: Readonly<Record<string, string>>,
  environment: NodeJS.ProcessEnv = process.env,
): PasswordSetRequest {
  const email = (options.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe --email com o e-mail da conta.');
  }

  // A senha pode vir por variável de ambiente para não ficar no histórico do shell.
  const password = options.password ?? environment.ARQUEIA_NEW_PASSWORD ?? '';
  if (password.length < MINIMUM_PASSWORD_LENGTH || password.length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `A senha deve ter entre ${MINIMUM_PASSWORD_LENGTH} e ${MAXIMUM_PASSWORD_LENGTH} caracteres. ` +
        'Passe --password ou defina ARQUEIA_NEW_PASSWORD.',
    );
  }

  return { email, password };
}

export async function setLocalPassword(
  pool: DatabasePool,
  request: PasswordSetRequest,
  hashPassword: (password: string) => Promise<string> = (password) =>
    hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    }),
): Promise<{ readonly userId: string; readonly email: string }> {
  const passwordHash = await hashPassword(request.password);

  return inTransaction(pool, async (client: DatabaseClient) => {
    const userResult = await client.query<{ id: string; email: string }>(
      `SELECT id, email
         FROM users
        WHERE lower(email) = $1
          AND status = 'ACTIVE'
          AND archived_at IS NULL
        FOR UPDATE`,
      [request.email],
    );
    const user = userResult.rows[0];
    if (user === undefined) {
      throw new Error(`Nenhuma conta ativa com o e-mail ${request.email}.`);
    }

    await client.query(
      `INSERT INTO local_credentials (user_id, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         password_changed_at = now(),
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = now()`,
      [user.id, passwordHash],
    );

    // A senha foi escolhida por quem rodou o comando, não pelo dono da conta:
    // a próxima entrada pede troca, como em qualquer redefinição administrativa.
    await client.query(
      `UPDATE users SET must_change_password = true, updated_at = now() WHERE id = $1`,
      [user.id],
    );

    // Invalida links de redefinição pendentes: a senha mudou por outro caminho.
    await client.query(
      `UPDATE password_reset_tokens SET used_at = now()
        WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    await client.query(
      `INSERT INTO audit_events (actor_id, laboratory_id, action, entity, entity_id,
                                 before, after, origin, request_id)
       VALUES ($1, NULL, 'identity.user.password_reset_by_admin', 'User', $1,
               NULL, $2::jsonb, 'cli:password-set', NULL)`,
      [user.id, JSON.stringify({ credentialUpdated: true, userId: user.id })],
    );

    return { userId: user.id, email: user.email };
  });
}

async function main(): Promise<string> {
  const { options } = parseArgs(process.argv.slice(2));
  const request = parsePasswordSetRequest(options);
  const result = await withPool((pool) => setLocalPassword(pool, request));
  return `Senha redefinida para ${result.email}. O próximo login vai pedir a troca da senha.`;
}

if (isDirectExecution(import.meta.url)) {
  runCli('password-set', main);
}
