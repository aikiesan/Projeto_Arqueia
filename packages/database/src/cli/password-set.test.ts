import { describe, expect, it, vi } from 'vitest';

import type { DatabasePool } from '../client.js';
import { parsePasswordSetRequest, setLocalPassword } from './password-set.js';

describe('parsePasswordSetRequest', () => {
  it('normalizes the e-mail and takes the password from the environment', () => {
    const request = parsePasswordSetRequest(
      { email: '  Lucasnc@Unicamp.BR ' },
      { ARQUEIA_NEW_PASSWORD: 'senha-de-emergencia' },
    );

    expect(request).toEqual({ email: 'lucasnc@unicamp.br', password: 'senha-de-emergencia' });
  });

  it('refuses a password shorter than the policy, so the CLI is not a back door', () => {
    expect(() => parsePasswordSetRequest({ email: 'a@unicamp.br', password: 'curta' }, {})).toThrow(
      /entre 12 e 128/,
    );
  });

  it('refuses a missing or malformed e-mail', () => {
    expect(() => parsePasswordSetRequest({ password: 'senha-de-emergencia' }, {})).toThrow(/--email/);
    expect(() =>
      parsePasswordSetRequest({ email: 'sem-arroba', password: 'senha-de-emergencia' }, {}),
    ).toThrow(/--email/);
  });
});

function poolWithUser(rows: readonly { id: string; email: string }[]) {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM users')) return Promise.resolve({ rows });
    return Promise.resolve({ rows: [] });
  });
  const client = { query };
  const pool = {
    connect: vi.fn().mockResolvedValue({ ...client, release: vi.fn() }),
    query,
  } as unknown as DatabasePool;
  return { pool, query };
}

describe('setLocalPassword', () => {
  it('writes the credential, clears the lockout, and records the audit event', async () => {
    const { pool, query } = poolWithUser([{ id: 'user-1', email: 'lucasnc@unicamp.br' }]);

    const result = await setLocalPassword(
      pool,
      { email: 'lucasnc@unicamp.br', password: 'senha-de-emergencia' },
      () => Promise.resolve('$argon2id$hash'),
    );

    expect(result).toEqual({ userId: 'user-1', email: 'lucasnc@unicamp.br' });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes('locked_until = NULL'))).toBe(true);
    expect(statements.some((sql) => sql.includes('must_change_password = true'))).toBe(true);
    expect(statements.some((sql) => sql.includes("'cli:password-set'"))).toBe(true);
  });

  it('invalidates pending reset links, since the password changed by another route', async () => {
    const { pool, query } = poolWithUser([{ id: 'user-1', email: 'lucasnc@unicamp.br' }]);

    await setLocalPassword(
      pool,
      { email: 'lucasnc@unicamp.br', password: 'senha-de-emergencia' },
      () => Promise.resolve('$argon2id$hash'),
    );

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes('password_reset_tokens'))).toBe(true);
  });

  it('fails loudly when there is no active account with that e-mail', async () => {
    const { pool } = poolWithUser([]);

    await expect(
      setLocalPassword(pool, { email: 'ninguem@unicamp.br', password: 'senha-de-emergencia' }, () =>
        Promise.resolve('$argon2id$hash'),
      ),
    ).rejects.toThrow(/Nenhuma conta ativa/);
  });
});
