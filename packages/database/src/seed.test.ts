import type { DatabasePool } from './client.js';
import { Algorithm, verify } from '@node-rs/argon2';
import { describe, expect, it, vi } from 'vitest';

import {
  DEVELOPMENT_SEED,
  hashAdminPassword,
  runSeed,
  seedDevelopmentData,
  validateSeedEnvironment,
} from './seed.js';

const validPassword = 'valid-dev-password';

interface QueryCall {
  readonly statement: string;
  readonly parameters: readonly unknown[];
}

function createDatabaseDouble(
  options: {
    readonly catalogSourceExists?: boolean;
    readonly credentialExists?: boolean;
    readonly roleAssignmentExists?: boolean;
    readonly failWhen?: string;
  } = {},
) {
  const calls: QueryCall[] = [];
  const release = vi.fn();

  const query = vi.fn(async (statement: string, parameters: readonly unknown[] = []) => {
    calls.push({ statement, parameters });

    if (options.failWhen !== undefined && statement.includes(options.failWhen)) {
      throw new Error('database unavailable');
    }

    if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
      return { rowCount: null, rows: [] };
    }
    if (statement.includes('INSERT INTO institutions')) {
      return { rowCount: 1, rows: [{ id: 'institution-id' }] };
    }
    if (statement.includes('INSERT INTO laboratories')) {
      return { rowCount: 1, rows: [{ id: 'laboratory-id' }] };
    }
    if (statement.includes('INSERT INTO projects')) {
      return { rowCount: 1, rows: [{ id: 'project-id' }] };
    }
    if (statement.includes('INSERT INTO users')) {
      return { rowCount: 1, rows: [{ id: 'administrator-id' }] };
    }
    if (statement.startsWith('SELECT user_id FROM local_credentials')) {
      return options.credentialExists === true
        ? { rowCount: 1, rows: [{ user_id: 'administrator-id' }] }
        : { rowCount: 0, rows: [] };
    }
    if (statement.includes('INSERT INTO system_role_assignments')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'role-assignment-id',
            inserted: options.roleAssignmentExists !== true,
          },
        ],
      };
    }
    if (statement.includes('INSERT INTO catalog_sources')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'catalog-source-id',
            inserted: options.catalogSourceExists !== true,
          },
        ],
      };
    }
    if (statement.includes('mismatch_count')) {
      return { rowCount: 1, rows: [{ mismatch_count: 0 }] };
    }

    return { rowCount: 1, rows: [] };
  });

  const client = { query, release };
  const pool = {
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
  } as unknown as DatabasePool;

  return { calls, client, pool, query, release };
}

describe('development seed safeguards', () => {
  it('rejects production before creating a database connection', async () => {
    const createPool = vi.fn();

    await expect(
      runSeed(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://database.invalid/arqueia',
          DEV_SEED_ADMIN_PASSWORD: validPassword,
        },
        { createPool },
      ),
    ).rejects.toThrow(/proibido em produção/i);
    expect(createPool).not.toHaveBeenCalled();
  });

  it('requires a seed password with at least twelve characters', () => {
    expect(() =>
      validateSeedEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://database.invalid/arqueia',
      }),
    ).toThrow(/DEV_SEED_ADMIN_PASSWORD/);

    expect(() =>
      validateSeedEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://database.invalid/arqueia',
        DEV_SEED_ADMIN_PASSWORD: 'short',
      }),
    ).toThrow(/12 caracteres/);
  });
});

describe('development seed execution', () => {
  it('creates deterministic entities by natural keys in one transaction', async () => {
    const database = createDatabaseDouble();
    const hashPassword = vi.fn(async () => '$argon2id$test-hash');

    const result = await seedDevelopmentData(database.pool, validPassword, hashPassword);

    expect(database.calls[0]?.statement).toBe('BEGIN');
    expect(database.calls.at(-1)?.statement).toBe('COMMIT');
    expect(database.release).toHaveBeenCalledOnce();
    expect(result).toEqual({
      institutionId: 'institution-id',
      laboratoryId: 'laboratory-id',
      projectId: 'project-id',
      administratorId: 'administrator-id',
      credentialCreated: true,
      systemRoleAssignmentId: 'role-assignment-id',
      catalog: {
        sourceId: 'catalog-source-id',
        sourceCreated: true,
        sourceRowCount: expect.any(Number),
        optionCount: expect.any(Number),
      },
    });

    const statements = database.calls.map(({ statement }) => statement).join('\n');
    expect(statements).toContain('ON CONFLICT (acronym) WHERE archived_at IS NULL');
    expect(statements).toContain(
      'ON CONFLICT (institution_id, code) WHERE archived_at IS NULL',
    );
    expect(statements).toContain(
      'ON CONFLICT (laboratory_id, code) WHERE archived_at IS NULL',
    );
    expect(statements).toContain('ON CONFLICT (lower(email)) WHERE archived_at IS NULL');
    expect(statements).toContain(
      'ON CONFLICT (user_id, role) WHERE archived_at IS NULL',
    );
    expect(statements).toContain('INSERT INTO audit_events');
    expect(statements).toContain('INSERT INTO catalog_source_rows');
    expect(statements).toContain('INSERT INTO catalog_options');
    expect(statements).toContain('jsonb_to_recordset($2::jsonb)');
    expect(statements).toContain('jsonb_to_recordset($3::jsonb)');

    expect(database.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameters: [
            DEVELOPMENT_SEED.institution.name,
            DEVELOPMENT_SEED.institution.acronym,
          ],
        }),
        expect.objectContaining({
          parameters: expect.arrayContaining([DEVELOPMENT_SEED.project.code]),
        }),
        expect.objectContaining({
          parameters: expect.arrayContaining([DEVELOPMENT_SEED.administrator.email]),
        }),
      ]),
    );
    expect(hashPassword).toHaveBeenCalledWith(validPassword);
  });

  it('does not replace or rehash an existing local credential', async () => {
    const database = createDatabaseDouble({
      credentialExists: true,
      roleAssignmentExists: true,
      catalogSourceExists: true,
    });
    const hashPassword = vi.fn(async () => '$argon2id$unused');

    const result = await seedDevelopmentData(database.pool, validPassword, hashPassword);

    expect(result.credentialCreated).toBe(false);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(
      database.calls.some(({ statement }) => statement.includes('INSERT INTO local_credentials')),
    ).toBe(false);
    expect(database.calls.some(({ statement }) => statement.includes('INSERT INTO audit_events'))).toBe(
      false,
    );
  });

  it('rolls back and releases the client if any seed statement fails', async () => {
    const database = createDatabaseDouble({ failWhen: 'INSERT INTO institutions' });

    await expect(
      seedDevelopmentData(database.pool, validPassword, vi.fn()),
    ).rejects.toThrow('database unavailable');

    expect(database.calls[0]?.statement).toBe('BEGIN');
    expect(database.calls.at(-1)?.statement).toBe('ROLLBACK');
    expect(database.calls.some(({ statement }) => statement.includes('INSERT INTO institutions'))).toBe(
      true,
    );
    expect(database.release).toHaveBeenCalledOnce();
  });

  it('hashes the administrator password with Argon2id', async () => {
    const encoded = await hashAdminPassword(validPassword);

    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(verify(encoded, validPassword, { algorithm: Algorithm.Argon2id })).resolves.toBe(
      true,
    );
  });
});
