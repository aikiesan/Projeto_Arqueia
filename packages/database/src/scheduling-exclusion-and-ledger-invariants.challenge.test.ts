import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { MigrationBuilder } from 'node-pg-migrate';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDatabasePool, type DatabasePool } from './client.js';

const databaseUrl = process.env.DATABASE_URL;

const schedulingMigrationPath = fileURLToPath(
  new URL('../migrations/004_scheduling.cjs', import.meta.url),
);
const schedulingLifecycleMigrationPath = fileURLToPath(
  new URL('../migrations/008_scheduling_lifecycle.cjs', import.meta.url),
);
const stockMovementNonNegativeMigrationPath = fileURLToPath(
  new URL('../migrations/009_stock_movement_non_negative.cjs', import.meta.url),
);
const inventoryMigrationPath = fileURLToPath(
  new URL('../migrations/005_inventory.cjs', import.meta.url),
);

const require = createRequire(import.meta.url);

function renderMigrationSql(path: string, direction: 'up' | 'down' = 'up'): string {
  const migration = require(path) as {
    up(builder: MigrationBuilder): void;
    down(builder: MigrationBuilder): void;
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

  if (direction === 'up') {
    migration.up(builder);
  } else {
    migration.down(builder);
  }
  return builder.getSql();
}

describe('Milestone 3 Empirical Challenge: Migration DDL & Contract Invariants', () => {
  describe('Migration 009 (Stock Movement Non-Negative Balance Check)', () => {
    it('declares reversible up and down DDL for check constraint balance_after >= 0', () => {
      const upSql = renderMigrationSql(stockMovementNonNegativeMigrationPath, 'up');
      expect(upSql).toContain('ALTER TABLE "stock_movements"');
      expect(upSql).toContain('ADD CONSTRAINT "stock_movements_balance_after_non_negative_check"');
      expect(upSql).toContain('CHECK (balance_after >= 0)');

      const downSql = renderMigrationSql(stockMovementNonNegativeMigrationPath, 'down');
      expect(downSql).toContain('ALTER TABLE "stock_movements"');
      expect(downSql).toContain('DROP CONSTRAINT "stock_movements_balance_after_non_negative_check"');
    });
  });

  describe('Scheduling Exclusion Constraint DDL (Migrations 004 & 008)', () => {
    it('configures btree_gist exclusion on (equipment_id WITH =, period WITH &&)', () => {
      const up004 = renderMigrationSql(schedulingMigrationPath, 'up');
      expect(up004).toContain('equipment_occupations_no_overlap_excl');
      expect(up004).toContain('EXCLUDE USING gist');
      expect(up004).toContain('equipment_id WITH =');
      expect(up004).toContain('period WITH &&');

      const up008 = renderMigrationSql(schedulingLifecycleMigrationPath, 'up');
      expect(up008).toContain('equipment_occupations_no_overlap_excl');
      expect(up008).toContain('NOT IN (\'CANCELLED\', \'RELEASED_ABSENCE\')');
    });
  });

  describe('Append-Only Ledger & Audit Trigger Invariants', () => {
    it('attaches reject_append_only_mutation to stock_movements in 005_inventory', () => {
      const inventorySql = renderMigrationSql(inventoryMigrationPath, 'up');
      expect(inventorySql).toContain('CREATE TRIGGER stock_movements_append_only');
      expect(inventorySql).toContain('BEFORE UPDATE OR DELETE ON stock_movements');
      expect(inventorySql).toContain('reject_append_only_mutation()');
    });
  });
});

describe.skipIf(databaseUrl === undefined)(
  'Milestone 3 Empirical Challenge: Live PostgreSQL Stress & Concurrency Suite',
  () => {
  let pool: DatabasePool;
  const challengeLabId = randomUUID();
  const challengeInstitutionId = randomUUID();
  const challengeUserId = randomUUID();
  const challengeProjectId = randomUUID();
  const challengeCatalogSourceId = randomUUID();
  const challengeCatalogSourceRowId = randomUUID();
  const challengeCatalogOptionId = randomUUID();
  const challengeEquipmentId1 = randomUUID();
  const challengeEquipmentId2 = randomUUID();
  const challengeProductId = randomUUID();
  const challengeBatchId = randomUUID();
  const fixtureSuffix = challengeLabId.slice(0, 8);

  beforeAll(async () => {
      pool = createDatabasePool({ connectionString: databaseUrl!, maxConnections: 12 });
      await pool.query('SELECT 1');

      // Seed test sandbox hierarchy
      await pool.query(
        `INSERT INTO institutions (id, name, acronym) VALUES ($1, 'Instituição de Desafio M3', $2)
         ON CONFLICT (id) DO NOTHING`,
        [challengeInstitutionId, `ID-M3-${fixtureSuffix}`],
      );
      await pool.query(
        `INSERT INTO laboratories (id, institution_id, name, code, timezone)
         VALUES ($1, $2, 'Laboratório Desafio M3', 'LAB-M3', 'America/Sao_Paulo')
         ON CONFLICT (id) DO NOTHING`,
        [challengeLabId, challengeInstitutionId],
      );
      await pool.query(
        `INSERT INTO users (id, institution_id, name, email, status)
          VALUES ($1, $2, 'Usuário Desafio M3', $3, 'ACTIVE')
          ON CONFLICT (id) DO NOTHING`,
        [challengeUserId, challengeInstitutionId, `challenger_m3_${fixtureSuffix}@unicamp.br`],
      );
      await pool.query(
        `INSERT INTO memberships (id, user_id, laboratory_id, role)
         VALUES (gen_random_uuid(), $1, $2, 'TECNICO')`,
        [challengeUserId, challengeLabId],
      );
      await pool.query(
        `INSERT INTO projects (id, laboratory_id, code, name, status)
         VALUES ($1, $2, 'PROJ-M3', 'Projeto Desafio M3', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [challengeProjectId, challengeLabId],
      );
      await pool.query(
        `INSERT INTO catalog_sources (
           id, laboratory_id, source_key, display_name, source_type, sha256, schema_version
         ) VALUES (
           $1, $2, 'challenge-m3', 'Challenge M3', 'SPREADSHEET', $3, 1
         )`,
        [challengeCatalogSourceId, challengeLabId, '0'.repeat(64)],
      );
      await pool.query(
        `INSERT INTO catalog_source_rows (
           id, source_id, sheet_name, row_number, values, content_sha256
         ) VALUES (
           $1, $2, 'challenge', 1, '[]'::jsonb, $3
         )`,
        [challengeCatalogSourceRowId, challengeCatalogSourceId, '0'.repeat(64)],
      );
      await pool.query(
        `INSERT INTO catalog_options (
           id, laboratory_id, source_id, source_row_id, option_key,
           kind, code, label, is_selectable
         ) VALUES (
           $1, $2, $3, $4, 'spectro-m3',
           'EQUIPMENT_TYPE', 'SPECTRO-M3', 'Espectrômetro Desafio', true
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          challengeCatalogOptionId,
          challengeLabId,
          challengeCatalogSourceId,
          challengeCatalogSourceRowId,
        ],
      );
      await pool.query(
        `INSERT INTO equipment (id, laboratory_id, catalog_option_id, code, name, status, max_reservation_minutes, requires_training, requires_approval, absence_release_minutes)
         VALUES
           ($1, $3, $4, 'EQ-M3-A', 'Equipamento A Desafio', 'AVAILABLE', 720, false, false, 30),
           ($2, $3, $4, 'EQ-M3-B', 'Equipamento B Desafio', 'AVAILABLE', 720, false, false, 30)
         ON CONFLICT (id) DO NOTHING`,
        [challengeEquipmentId1, challengeEquipmentId2, challengeLabId, challengeCatalogOptionId],
      );
      await pool.query(
        `INSERT INTO products (id, laboratory_id, code, name, category, unit_of_measure, minimum_stock_threshold)
         VALUES ($1, $2, 'REAG-M3', 'Reagente Desafio M3', 'REAGENT', 'ML', 10.0)
         ON CONFLICT (id) DO NOTHING`,
        [challengeProductId, challengeLabId],
      );
      await pool.query(
        `INSERT INTO batches (id, laboratory_id, product_id, batch_number, initial_quantity, qr_code, status)
         VALUES ($1, $2, $3, 'LOTE-M3-001', 100.0, $4, 'AVAILABLE')
         ON CONFLICT (id) DO NOTHING`,
        [challengeBatchId, challengeLabId, challengeProductId, `ARQ-LOT-M3-${fixtureSuffix}`],
      );
      await pool.query(
        `INSERT INTO audit_events (
           actor_id, laboratory_id, action, entity, entity_id, before, after, origin
         ) VALUES (
           $1, $2, 'challenge.fixture.created', 'Product', $3, NULL, '{}'::jsonb, 'database:test'
         )`,
        [challengeUserId, challengeLabId, challengeProductId],
      );
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('PostgreSQL Exclusion Constraint (equipment_occupations_no_overlap_excl)', () => {
    it('rejects exact duplicate time range for the same equipment (23P01 exclusion_violation)', async () => {
      const startsAt = '2032-05-10T10:00:00.000Z';
      const endsAt = '2032-05-10T12:00:00.000Z';

      // Insert primary occupation
      const first = await pool.query(
        `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
         RETURNING id`,
        [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
      );
      expect(first.rowCount).toBe(1);

      // Attempt second identical occupation on same equipment
      await expect(
        pool.query(
          `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
           VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')`,
          [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
        ),
      ).rejects.toMatchObject({ code: '23P01' });
    });

    it('rejects partial overlapping range [11:00, 13:00) against [10:00, 12:00)', async () => {
      const startsAt = '2032-05-10T11:00:00.000Z';
      const endsAt = '2032-05-10T13:00:00.000Z';

      await expect(
        pool.query(
          `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
           VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')`,
          [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
        ),
      ).rejects.toMatchObject({ code: '23P01' });
    });

    it('rejects completely enclosed inner range [10:30, 11:30) against [10:00, 12:00)', async () => {
      const startsAt = '2032-05-10T10:30:00.000Z';
      const endsAt = '2032-05-10T11:30:00.000Z';

      await expect(
        pool.query(
          `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
           VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')`,
          [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
        ),
      ).rejects.toMatchObject({ code: '23P01' });
    });

    it('rejects completely enclosing outer range [09:00, 13:00) against [10:00, 12:00)', async () => {
      const startsAt = '2032-05-10T09:00:00.000Z';
      const endsAt = '2032-05-10T13:00:00.000Z';

      await expect(
        pool.query(
          `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
           VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')`,
          [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
        ),
      ).rejects.toMatchObject({ code: '23P01' });
    });

    it('allows adjacent contiguous range [12:00, 14:00) because [) interval semantics do not overlap at boundary', async () => {
      const startsAt = '2032-05-10T12:00:00.000Z';
      const endsAt = '2032-05-10T14:00:00.000Z';

      const adjacent = await pool.query(
        `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
         RETURNING id`,
        [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
      );
      expect(adjacent.rowCount).toBe(1);
    });

    it('allows concurrent occupation on different equipment for the same time window', async () => {
      const startsAt = '2032-05-10T10:00:00.000Z';
      const endsAt = '2032-05-10T12:00:00.000Z';

      // Same time window as Equipment 1, but on Equipment 2
      const resOnEq2 = await pool.query(
        `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
         RETURNING id`,
        [challengeLabId, challengeEquipmentId2, startsAt, endsAt],
      );
      expect(resOnEq2.rowCount).toBe(1);
    });

    it('permits booking once prior occupation is CANCELLED or RELEASED_ABSENCE', async () => {
      const startsAt = '2032-05-11T14:00:00.000Z';
      const endsAt = '2032-05-11T16:00:00.000Z';

      // Insert confirmed occupation
      const original = await pool.query<{ id: string }>(
        `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
         RETURNING id`,
        [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
      );
      const originalId = original.rows[0]!.id;

      // Cancel the original occupation
      await pool.query(
        `UPDATE equipment_occupations SET status = 'CANCELLED' WHERE id = $1`,
        [originalId],
      );

      // Now inserting the exact same slot MUST succeed
      const rebooked = await pool.query(
        `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
         RETURNING id`,
        [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
      );
      expect(rebooked.rowCount).toBe(1);
    });

    it('survives multi-connection concurrency burst (10 parallel inserts -> exactly 1 succeeds, 9 fail with 23P01)', async () => {
      const startsAt = '2032-05-15T08:00:00.000Z';
      const endsAt = '2032-05-15T10:00:00.000Z';

      const concurrencyLevel = 10;
      const tasks = Array.from({ length: concurrencyLevel }, () =>
        pool.query(
          `INSERT INTO equipment_occupations (laboratory_id, equipment_id, occupation_type, starts_at, ends_at, status)
           VALUES ($1, $2, 'RESERVATION', $3, $4, 'CONFIRMED')
           RETURNING id`,
          [challengeLabId, challengeEquipmentId1, startsAt, endsAt],
        ),
      );

      const results = await Promise.allSettled(tasks);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(concurrencyLevel - 1);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect((rej.reason as { code?: string }).code).toBe('23P01');
        }
      }
    });
  });

  describe('Stock Movement Non-Negative Balance Check (Constraint & Trigger Verification)', () => {
    it('strictly rejects negative balance_after in stock_movements with check_violation 23514', async () => {
      await expect(
        pool.query(
          `INSERT INTO stock_movements (
             laboratory_id, batch_id, product_id, user_id, project_id,
             movement_type, quantity, balance_after, purpose
           ) VALUES (
             $1, $2, $3, $4, $5,
             'WITHDRAWAL', 150.0, -50.0, 'Tentativa de saldo negativo'
           )`,
          [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('strictly rejects fractional negative balance_after (-0.0001) with check_violation 23514', async () => {
      await expect(
        pool.query(
          `INSERT INTO stock_movements (
             laboratory_id, batch_id, product_id, user_id, project_id,
             movement_type, quantity, balance_after, purpose
           ) VALUES (
             $1, $2, $3, $4, $5,
             'WITHDRAWAL', 100.0001, -0.0001, 'Tentativa de saldo fracionário negativo'
           )`,
          [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('accepts exact zero balance_after (0.0000)', async () => {
      await pool.query(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, project_id,
           movement_type, quantity, balance_after, purpose
         ) VALUES (
           $1, $2, $3, $4, $5,
           'ENTRY', 100.0, 100.0, 'Entrada para teste de saldo zero'
         )`,
        [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
      );

      const result = await pool.query(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, project_id,
           movement_type, quantity, balance_after, purpose
         ) VALUES (
           $1, $2, $3, $4, $5,
           'WITHDRAWAL', 100.0, 0.0, 'Saldo zerado permitido'
         ) RETURNING id, balance_after`,
        [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
      );

      expect(result.rowCount).toBe(1);
      expect(Number(result.rows[0]?.balance_after)).toBe(0);
    });

    it('accepts positive balance_after (125.5000)', async () => {
      const result = await pool.query(
        `INSERT INTO stock_movements (
           laboratory_id, batch_id, product_id, user_id, project_id,
           movement_type, quantity, balance_after, purpose
         ) VALUES (
           $1, $2, $3, $4, $5,
           'ENTRY', 125.5, 125.5, 'Saldo positivo'
         ) RETURNING id, balance_after`,
        [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
      );

      expect(result.rowCount).toBe(1);
      expect(Number(result.rows[0]?.balance_after)).toBe(125.5);
    });

    it('rejects a positive balance_after that does not match the ledger sum', async () => {
      await expect(
        pool.query(
          `INSERT INTO stock_movements (
             laboratory_id, batch_id, product_id, user_id, project_id,
             movement_type, quantity, balance_after, purpose
           ) VALUES (
             $1, $2, $3, $4, $5,
             'ENTRY', 10.0, 999.0, 'Snapshot inconsistente'
           )`,
          [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'stock_movements_ledger_consistency_check',
      });
    });

    it('serializes concurrent ledger writers and rejects stale balance snapshots', async () => {
      const attempts = Array.from({ length: 10 }, () =>
        pool.query(
          `INSERT INTO stock_movements (
             laboratory_id, batch_id, product_id, user_id, project_id,
             movement_type, quantity, balance_after, purpose
           ) VALUES (
             $1, $2, $3, $4, $5,
             'WITHDRAWAL', 20.0, 105.5, 'Retirada concorrente'
           )`,
          [challengeLabId, challengeBatchId, challengeProductId, challengeUserId, challengeProjectId],
        ),
      );

      const results = await Promise.allSettled(attempts);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(9);
    });

    it('enforces append-only rule: UPDATE on stock_movements is rejected with 55000', async () => {
      await expect(
        pool.query(
          `UPDATE stock_movements SET quantity = 999 WHERE laboratory_id = $1`,
          [challengeLabId],
        ),
      ).rejects.toMatchObject({ code: '55000' });
    });

    it('enforces append-only rule: DELETE on stock_movements is rejected with 55000', async () => {
      await expect(
        pool.query(
          `DELETE FROM stock_movements WHERE laboratory_id = $1`,
          [challengeLabId],
        ),
      ).rejects.toMatchObject({ code: '55000' });
    });

    it('enforces append-only rule: UPDATE on audit_events is rejected with 55000', async () => {
      await expect(
        pool.query(
          `UPDATE audit_events SET action = 'tampered' WHERE laboratory_id = $1`,
          [challengeLabId],
        ),
      ).rejects.toMatchObject({ code: '55000' });
    });
  });
});
