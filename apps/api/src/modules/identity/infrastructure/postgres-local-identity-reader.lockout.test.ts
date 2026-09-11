import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresLocalIdentityReader } from './postgres-local-identity-reader.js';

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function readerWith(rows: ReadonlyArray<{ failed_attempts: number; locked_until: Date | null }>) {
  const query = vi.fn(async () => ({ rows: [...rows] }));
  const pool = { query } as unknown as DatabasePool;
  return { query, reader: new PostgresLocalIdentityReader(pool) };
}

describe('PostgresLocalIdentityReader.recordLoginFailure', () => {
  it('recomeça a contagem quando o bloqueio anterior já venceu', async () => {
    const { query, reader } = readerWith([{ failed_attempts: 1, locked_until: null }]);

    const result = await reader.recordLoginFailure(userId, 5, 900);

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, readonly unknown[]];
    // Um `locked_until` preenchido só sobrevive até aqui se já tiver vencido:
    // o caso de uso interrompe antes quando o bloqueio ainda está em vigor.
    expect(sql).toContain('CASE WHEN locked_until IS NOT NULL THEN 0 ELSE failed_attempts END');
    expect(sql).toContain('previous.attempts + 1');
    expect(parameters).toEqual([userId, 5, 900]);
    expect(result).toEqual({ failedAttempts: 1, isLocked: false, lockedUntil: null });
  });

  it('bloqueia ao atingir o limite e devolve o instante de liberação', async () => {
    const lockedUntil = new Date('2026-09-11T12:15:00.000Z');
    const { reader } = readerWith([{ failed_attempts: 5, locked_until: lockedUntil }]);

    const result = await reader.recordLoginFailure(userId, 5, 900);

    expect(result).toEqual({
      failedAttempts: 5,
      isLocked: true,
      lockedUntil: lockedUntil.toISOString(),
    });
  });

  it('não bloqueia enquanto a contagem estiver abaixo do limite', async () => {
    const { reader } = readerWith([{ failed_attempts: 3, locked_until: null }]);

    await expect(reader.recordLoginFailure(userId, 5, 900)).resolves.toEqual({
      failedAttempts: 3,
      isLocked: false,
      lockedUntil: null,
    });
  });
});
