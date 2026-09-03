import { describe, expect, it, vi } from 'vitest';

import type { DatabasePool } from './client.js';
import {
  bootstrapFirstAdministrator,
  runBootstrapAdmin,
  validateBootstrapAdminEnvironment,
} from './bootstrap-admin.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://database.invalid/arqueia',
  BOOTSTRAP_ADMIN_NAME: 'Lucas Administrador',
  BOOTSTRAP_ADMIN_EMAIL: 'lucas@unicamp.br',
  BOOTSTRAP_ADMIN_PASSWORD: 'frase-segura-local',
} as const;

function databaseDouble(existingAdmin = false) {
  const calls: string[] = [];
  const query = vi.fn(async (statement: string) => {
    calls.push(statement);
    if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
      return { rowCount: null, rows: [] };
    }
    if (statement.includes('SELECT EXISTS')) {
      return { rowCount: 1, rows: [{ exists: existingAdmin }] };
    }
    if (statement.includes('INSERT INTO institutions')) {
      return { rowCount: 1, rows: [{ id: 'institution-id' }] };
    }
    if (statement.includes('INSERT INTO laboratories')) {
      return { rowCount: 1, rows: [{ id: 'laboratory-id' }] };
    }
    if (statement.includes('INSERT INTO users')) {
      return { rowCount: 1, rows: [{ id: 'administrator-id' }] };
    }
    if (statement.includes('INSERT INTO system_role_assignments')) {
      return { rowCount: 1, rows: [{ id: 'assignment-id' }] };
    }
    return { rowCount: 1, rows: [] };
  });
  const client = { query, release: vi.fn() };
  const pool = {
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
  } as unknown as DatabasePool;
  return { calls, pool, query };
}

describe('bootstrap do primeiro administrador', () => {
  it('normaliza o e-mail institucional e aplica padrões do CP2B', () => {
    const config = validateBootstrapAdminEnvironment({
      ...validEnvironment,
      BOOTSTRAP_ADMIN_EMAIL: ' Lucas@NIPE.UNICAMP.BR ',
    });

    expect(config.email).toBe('lucas@nipe.unicamp.br');
    expect(config.institutionAcronym).toBe('UNICAMP');
    expect(config.laboratoryCode).toBe('CP2b');
  });

  it('recusa e-mail externo e senha curta', () => {
    expect(() =>
      validateBootstrapAdminEnvironment({
        ...validEnvironment,
        BOOTSTRAP_ADMIN_EMAIL: 'lucas@example.com',
      }),
    ).toThrow();
    expect(() =>
      validateBootstrapAdminEnvironment({
        ...validEnvironment,
        BOOTSTRAP_ADMIN_PASSWORD: 'curta',
      }),
    ).toThrow(/12 e 128/);
  });

  it('cria instituição, laboratório, credencial, ADMIN e auditoria em uma transação', async () => {
    const { calls, pool } = databaseDouble();
    const hashPassword = vi.fn(async () => 'argon2id-hash');
    const config = validateBootstrapAdminEnvironment(validEnvironment);

    const result = await bootstrapFirstAdministrator(pool, config, hashPassword);

    expect(result).toEqual({
      administratorId: 'administrator-id',
      institutionId: 'institution-id',
      laboratoryId: 'laboratory-id',
      email: 'lucas@unicamp.br',
    });
    expect(hashPassword).toHaveBeenCalledWith(validEnvironment.BOOTSTRAP_ADMIN_PASSWORD);
    expect(calls.some((sql) => sql.includes('INSERT INTO local_credentials'))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO audit_events'))).toBe(true);
    expect(calls).toContain('COMMIT');
  });

  it('recusa um segundo ADMIN e desfaz a transação', async () => {
    const { calls, pool } = databaseDouble(true);
    const config = validateBootstrapAdminEnvironment(validEnvironment);

    await expect(
      bootstrapFirstAdministrator(pool, config, vi.fn(async () => 'unused')),
    ).rejects.toThrow(/Já existe um administrador/);
    expect(calls).toContain('ROLLBACK');
    expect(calls.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });

  it('fecha o pool mesmo quando a operação falha', async () => {
    const { pool } = databaseDouble(true);
    await expect(
      runBootstrapAdmin(validEnvironment, {
        createPool: () => pool,
        hashPassword: vi.fn(async () => 'unused'),
      }),
    ).rejects.toThrow(/Já existe um administrador/);
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
