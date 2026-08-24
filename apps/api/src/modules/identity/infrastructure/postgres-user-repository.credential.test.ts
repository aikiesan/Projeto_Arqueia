import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresUserRepository } from './postgres-user-repository.js';

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const actorId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

describe('PostgresUserRepository credential writes', () => {
  it('updates the hash, clears lockout and appends sanitized audit in one transaction', async () => {
    const query = vi.fn(async (sql: string, _parameters?: readonly unknown[]) => {
      if (sql.includes('SELECT id') && sql.includes('FROM users')) {
        return { rows: [{ id: userId }] };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as DatabasePool;
    const repository = new PostgresUserRepository(pool);
    const passwordHash = '$argon2id$sensitive-hash';

    await repository.setPasswordHash(
      userId,
      passwordHash,
      { actorId, origin: 'api:test', requestId: null },
      'identity.user.password_reset_by_admin',
    );

    const credentialCall = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO local_credentials'),
    );
    const userLockCall = query.mock.calls.find(
      ([sql]) => sql.includes('SELECT id') && sql.includes('FROM users'),
    );
    expect(userLockCall?.[0]).toContain("status = 'ACTIVE'");
    expect(userLockCall?.[0]).toContain("identity_provider = 'LOCAL'");
    expect(userLockCall?.[0]).toContain('FOR UPDATE');
    expect(credentialCall?.[0]).toContain('failed_attempts = 0');
    expect(credentialCall?.[0]).toContain('locked_until = NULL');
    expect(credentialCall?.[1]).toEqual([userId, passwordHash]);

    const auditCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_events'));
    expect(auditCall?.[1]).toEqual([
      actorId,
      null,
      'identity.user.password_reset_by_admin',
      'User',
      userId,
      null,
      JSON.stringify({ credentialUpdated: true, userId }),
      'api:test',
      null,
    ]);
    expect(JSON.stringify(auditCall)).not.toContain(passwordHash);
    expect(query.mock.calls.map(([sql]) => sql.trim())).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT']),
    );
    expect(release).toHaveBeenCalledOnce();
  });
});
