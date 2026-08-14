import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { MigrationBuilder } from 'node-pg-migrate';
import { describe, expect, it, vi } from 'vitest';

const migrationPath = fileURLToPath(new URL('../migrations/001_foundation.cjs', import.meta.url));
const catalogMigrationPath = fileURLToPath(
  new URL('../migrations/002_reference_catalog.cjs', import.meta.url),
);
const equipmentMigrationPath = fileURLToPath(
  new URL('../migrations/003_equipment.cjs', import.meta.url),
);
const schedulingMigrationPath = fileURLToPath(
  new URL('../migrations/004_scheduling.cjs', import.meta.url),
);
const schedulingScopeMigrationPath = fileURLToPath(
  new URL('../migrations/007_scheduling_scope_constraints.cjs', import.meta.url),
);
const inventoryMigrationPath = fileURLToPath(
  new URL('../migrations/005_inventory.cjs', import.meta.url),
);
const managementMigrationPath = fileURLToPath(
  new URL('../migrations/006_management_audit_indexes.cjs', import.meta.url),
);
const require = createRequire(import.meta.url);

function renderMigrationSql(path = migrationPath): string {
  const migration = require(path) as {
    up(builder: MigrationBuilder): void;
  };
  const database = {
    query: vi.fn(),
    select: vi.fn(),
  } as never;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const builder = new MigrationBuilder(database, undefined, false, logger);

  migration.up(builder);
  return builder.getSql();
}

describe('foundation migration invariants', () => {
  it('enables btree_gist for reservation exclusion constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("createExtension('btree_gist'");
  });

  it('can be rendered by the selected migration tool', () => {
    const sql = renderMigrationSql();

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    expect(sql).toContain('CREATE TABLE "audit_events"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON audit_events');
  });

  it('makes audit events append-only at the database boundary', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('reject_append_only_mutation');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON audit_events');
  });

  it('models global and laboratory roles separately', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('system_role_assignments');
    expect(migration).toContain("role IN ('USUARIO', 'TECNICO', 'RESPONSAVEL_CONTROLADOS')");
    expect(migration).toContain("role IN ('ADMIN')");
  });
});

describe('reference catalog migration invariants', () => {
  it('keeps imported source rows append-only and options laboratory-scoped', () => {
    const sql = renderMigrationSql(catalogMigrationPath);

    expect(sql).toContain('CREATE TABLE "catalog_sources"');
    expect(sql).toContain('CREATE TABLE "catalog_source_rows"');
    expect(sql).toContain('CREATE TABLE "catalog_options"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON catalog_source_rows');
    expect(sql).toContain('catalog_options_lab_kind_active_idx');
    expect(sql).toContain('laboratory_id');
  });

  it('stores provenance separately from the public normalized option', async () => {
    const migration = await readFile(catalogMigrationPath, 'utf8');

    expect(migration).toContain("jsonb_typeof(values) = 'array'");
    expect(migration).toContain('source_row_id');
    expect(migration).toContain("jsonb_typeof(details) = 'object'");
    expect(migration).toContain("replace(name, 'CP2B', 'CP2b')");
  });
});

describe('equipment migration invariants', () => {
  it('keeps equipment scoped to the same laboratory as catalog references', () => {
    const sql = renderMigrationSql(equipmentMigrationPath);

    expect(sql).toContain('CREATE TABLE "equipment"');
    expect(sql).toContain('equipment_catalog_option_lab_fk');
    expect(sql).toContain('equipment_space_option_lab_fk');
    expect(sql).toContain('equipment_bench_option_lab_fk');
    expect(sql).toContain('catalog_options(laboratory_id, id)');
  });

  it('uses archival uniqueness and database bounds for reservation policy', () => {
    const sql = renderMigrationSql(equipmentMigrationPath);

    expect(sql).toContain('equipment_lab_code_active_uk');
    expect(sql).toContain('max_reservation_minutes BETWEEN 30 AND 10080');
    expect(sql).toContain('absence_release_minutes BETWEEN 0 AND 240');
    expect(sql).toContain('archived_at IS NULL');
  });
});

describe('scheduling migration invariants', () => {
  it('creates occupations table with tstzrange exclusion constraint for concurrency', () => {
    const sql = renderMigrationSql(schedulingMigrationPath);

    expect(sql).toContain('CREATE TABLE "equipment_occupations"');
    expect(sql).toContain("tstzrange(starts_at, ends_at, '[)')");
    expect(sql).toContain('equipment_occupations_no_overlap_excl');
    expect(sql).toContain('EXCLUDE USING gist');
    expect(sql).toContain('CREATE TABLE "reservations"');
    expect(sql).toContain('CREATE TABLE "technical_blocks"');
  });

  it('requires mandatory project_id on reservations', async () => {
    const migration = await readFile(schedulingMigrationPath, 'utf8');

    expect(migration).toContain('project_id');
    expect(migration).toContain("references: 'projects'");
  });

  it('enforces laboratory consistency across occupations, reservations and projects', () => {
    const sql = renderMigrationSql(schedulingScopeMigrationPath);

    expect(sql).toContain('equipment_occupations_equipment_scope_fk');
    expect(sql).toContain('reservations_occupation_scope_fk');
    expect(sql).toContain('reservations_project_scope_fk');
    expect(sql).toContain('technical_blocks_occupation_scope_fk');
    expect(sql).toContain('equipment(laboratory_id, id)');
    expect(sql).toContain('projects(laboratory_id, id)');
    expect(sql).toContain('equipment_occupations(laboratory_id, equipment_id, id)');
  });
});

describe('inventory migration invariants', () => {
  it('creates products, batches and append-only stock_movements ledger tables', () => {
    const sql = renderMigrationSql(inventoryMigrationPath);

    expect(sql).toContain('CREATE TABLE "products"');
    expect(sql).toContain('CREATE TABLE "batches"');
    expect(sql).toContain('CREATE TABLE "stock_movements"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON stock_movements');
    expect(sql).toContain('reject_append_only_mutation');
  });

  it('enforces product code uniqueness per active laboratory', async () => {
    const migration = await readFile(inventoryMigrationPath, 'utf8');

    expect(migration).toContain('products_lab_code_active_uk');
    expect(migration).toContain('batches_qr_code_active_uk');
  });
});

describe('management audit indexes migration invariants', () => {
  it('creates stable timeline indexes for actor and cursor-based audit pagination using occurred_at', () => {
    const sql = renderMigrationSql(managementMigrationPath);

    expect(sql).toContain('audit_events_actor_timeline_idx');
    expect(sql).toContain('audit_events_lab_timeline_cursor_idx');
    expect(sql).toContain('occurred_at');
  });
});
