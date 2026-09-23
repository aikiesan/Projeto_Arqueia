import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { DatabasePool } from '../client.js';
import { connectIntegrationDatabase, resolveIntegrationDatabase } from './integration-database.js';

const ciUrl = 'postgresql://arqueia:arqueia_test@localhost:5432/arqueia_test';

function refusalReason(url: string | undefined): string {
  const decision = resolveIntegrationDatabase(url === undefined ? {} : { DATABASE_URL: url });
  if (decision.enabled) throw new Error(`Esperava recusa para ${url}, veio ${decision.databaseName}.`);
  return decision.reason;
}

describe('resolveIntegrationDatabase', () => {
  it('habilita o banco da CI', () => {
    expect(resolveIntegrationDatabase({ DATABASE_URL: ciUrl })).toEqual({
      enabled: true,
      connectionString: ciUrl,
      databaseName: 'arqueia_test',
    });
  });

  it('aceita o esquema postgres:// e apara espaços em volta', () => {
    const decision = resolveIntegrationDatabase({
      DATABASE_URL: '  postgres://arqueia@127.0.0.1:5433/arqueia_test?sslmode=disable  ',
    });
    expect(decision).toEqual({
      enabled: true,
      connectionString: 'postgres://arqueia@127.0.0.1:5433/arqueia_test?sslmode=disable',
      databaseName: 'arqueia_test',
    });
  });

  it('lê o nome codificado como o pg lê', () => {
    expect(resolveIntegrationDatabase({ DATABASE_URL: 'postgresql://h/arqueia%5Ftest' })).toMatchObject({
      enabled: true,
      databaseName: 'arqueia_test',
    });
  });

  it.each([undefined, '', '   '])('recusa DATABASE_URL ausente ou vazia (%j)', (url) => {
    expect(refusalReason(url)).toMatch(/DATABASE_URL não definida/);
  });

  it('recusa o banco de produção sem vazar a senha no motivo', () => {
    const reason = refusalReason('postgresql://arqueia:senha-da-vm@127.0.0.1:5432/arqueia');
    expect(reason).toMatch(/"arqueia" não termina em _test/);
    expect(reason).not.toContain('senha-da-vm');
  });

  it.each([
    'postgresql://arqueia@localhost/arqueia?application_name=suite_test',
    'postgresql://arqueia@localhost/arqueia?options=-c%20x=_test',
    'postgresql://arqueia@localhost/arqueia#_test',
  ])('só conta o sufixo no nome do banco, não no resto da URL (%s)', (url) => {
    expect(refusalReason(url)).toMatch(/"arqueia" não termina em _test/);
  });

  it.each(['arqueia_test_copia', 'arqueia_testing', 'arqueiatest', 'arqueia_TEST', 'arqueia_test/'])(
    'recusa nomes parecidos (%s)',
    (name) => {
      expect(refusalReason(`postgresql://localhost/${name}`)).toMatch(/não termina em _test/);
    },
  );

  it.each(['postgresql://arqueia@localhost:5432', 'postgresql://arqueia@localhost:5432/'])(
    'recusa URL sem nome de banco, que cairia em PGDATABASE ou no usuário (%s)',
    (url) => {
      expect(refusalReason(url)).toMatch(/não nomeia o banco/);
    },
  );

  it.each([
    'mysql://arqueia@localhost/arqueia_test',
    'arqueia_test',
    '/var/run/postgresql arqueia_test',
    'postgresql://arqueia@/arqueia_test',
  ])('recusa o que não consegue ler como URL postgres (%s)', (url) => {
    expect(refusalReason(url)).toMatch(/não é uma URL postgres/);
  });

  it('recusa escape malformado sem lançar', () => {
    expect(refusalReason('postgresql://localhost/%E0%A4%A_test')).toMatch(/não nomeia o banco/);
  });

  // Uma suíte pulada não quebra nada: se o banco da CI mudar de nome, as três
  // suítes sumiriam sem aviso. O GitHub Actions define CI=true.
  it.runIf(Boolean(process.env.CI))('na CI, DATABASE_URL habilita as suítes de integração', () => {
    const decision = resolveIntegrationDatabase();
    expect(decision.enabled ? 'habilitada' : decision.reason).toBe('habilitada');
  });
});

describe('connectIntegrationDatabase', () => {
  function fakePool(query: () => Promise<unknown>) {
    const end = vi.fn(async () => undefined);
    const pool = { query: vi.fn(query), end } as unknown as DatabasePool;
    const createPool = vi.fn(() => pool);
    return { pool, end, createPool };
  }

  const enabled = resolveIntegrationDatabase({ DATABASE_URL: ciUrl });

  it('não abre pool quando a coleta recusou o banco', async () => {
    const { createPool } = fakePool(async () => ({ rows: [] }));
    const refused = resolveIntegrationDatabase({ DATABASE_URL: 'postgresql://localhost/arqueia' });

    await expect(connectIntegrationDatabase(refused, 4, createPool)).rejects.toThrow(
      /"arqueia" não termina em _test/,
    );
    expect(createPool).not.toHaveBeenCalled();
  });

  it('devolve o pool quando o servidor confirma um banco _test', async () => {
    const { pool, end, createPool } = fakePool(async () => ({ rows: [{ name: 'arqueia_test' }] }));

    await expect(connectIntegrationDatabase(enabled, 8, createPool)).resolves.toBe(pool);
    expect(createPool).toHaveBeenCalledWith({ connectionString: ciUrl, maxConnections: 8 });
    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS name');
    expect(end).not.toHaveBeenCalled();
  });

  it('fecha o pool e rejeita quando o servidor conectou em outro banco', async () => {
    const { end, createPool } = fakePool(async () => ({ rows: [{ name: 'arqueia' }] }));

    await expect(connectIntegrationDatabase(enabled, 4, createPool)).rejects.toThrow(
      /nomeia "arqueia_test", mas o servidor conectou em "arqueia"/,
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('fecha o pool e propaga o erro original quando a conexão falha', async () => {
    const failure = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const { end, createPool } = fakePool(async () => {
      throw failure;
    });

    await expect(connectIntegrationDatabase(enabled, 4, createPool)).rejects.toBe(failure);
    expect(end).toHaveBeenCalledTimes(1);
  });
});

/**
 * Uma suíte nova que copie o padrão antigo (`process.env.DATABASE_URL` direto no
 * `createDatabasePool`) contornaria o guarda. Esta auditoria percorre os testes
 * do monorepo e só aceita conexão real que passe por `connectIntegrationDatabase`.
 */
describe('auditoria das suítes que abrem conexão real', () => {
  const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
  const guardTest = relative(repositoryRoot, fileURLToPath(import.meta.url)).split(sep).join('/');
  const ignoredDirectories = new Set(['node_modules', 'dist', '.next', 'coverage', 'test-results']);

  function testFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : testFiles(path);
      return /\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  const suites = ['apps', 'packages', 'tests']
    .flatMap((directory) => testFiles(join(repositoryRoot, directory)))
    .map((path) => ({
      file: relative(repositoryRoot, path).split(sep).join('/'),
      source: readFileSync(path, 'utf8'),
    }))
    .filter(({ file }) => file !== guardTest);

  it('nenhum teste lê DATABASE_URL nem abre pool por fora do guarda', () => {
    const bypass = /process\.env(\.DATABASE_URL|\[\s*['"]DATABASE_URL['"]\s*\])|createDatabasePool\s*\(|new\s+(pg\.)?(Pool|Client)\s*\(/;
    expect(suites.filter(({ source }) => bypass.test(source)).map(({ file }) => file)).toEqual([]);
  });

  it('as três suítes que escrevem no banco passam pelo guarda', () => {
    const guarded = suites
      .filter(({ source }) => source.includes('connectIntegrationDatabase('))
      .map(({ file }) => file)
      .sort();
    expect(guarded).toEqual([
      'apps/api/src/modules/inventory/infrastructure/postgres-inventory-repository.integration.test.ts',
      'apps/api/src/modules/scheduling/infrastructure/postgres-scheduling-repository.integration.test.ts',
      'packages/database/src/scheduling-exclusion-and-ledger-invariants.challenge.test.ts',
    ]);
  });
});
