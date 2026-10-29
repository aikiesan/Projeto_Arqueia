import type { DatabasePool } from '@arqueia/database';

import type {
  ConsumedPasswordResetToken,
  IssuePasswordResetTokenRecord,
  PasswordResetTokenConsumer,
  PasswordResetTokenWriter,
} from '../domain/ports/password-reset-token-repository.port.js';

export class PostgresPasswordResetTokenRepository
  implements PasswordResetTokenWriter, PasswordResetTokenConsumer
{
  public constructor(private readonly pool: DatabasePool) {}

  public async invalidatePending(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_reset_tokens
          SET used_at = now()
        WHERE user_id = $1
          AND used_at IS NULL`,
      [userId],
    );
  }

  public async issue(record: IssuePasswordResetTokenRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, origin, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [record.userId, record.tokenHash, record.origin, record.expiresAt],
    );
  }

  /**
   * Marcar e devolver em um único UPDATE: é o `used_at IS NULL` da cláusula
   * WHERE que garante que dois pedidos simultâneos com o mesmo token não
   * redefinam a senha duas vezes — o segundo não encontra linha.
   */
  public async consume(tokenHash: string): Promise<ConsumedPasswordResetToken | null> {
    const result = await this.pool.query<{ id: string; user_id: string }>(
      `UPDATE password_reset_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING id, user_id`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row === undefined ? null : { id: row.id, userId: row.user_id };
  }
}
