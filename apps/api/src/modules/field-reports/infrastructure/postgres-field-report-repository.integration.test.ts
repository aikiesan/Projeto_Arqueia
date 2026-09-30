import { randomUUID } from 'node:crypto';

import type { FieldReportSummary } from '@arqueia/contracts';
import {
  connectIntegrationDatabase,
  resolveIntegrationDatabase,
  type DatabasePool,
} from '@arqueia/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { summarizeFieldReports } from '../domain/field-report-summary.js';
import {
  FieldReportEquipmentMismatchError,
  FieldReportLaboratoryNotFoundError,
} from '../domain/field-report.errors.js';
import { PostgresFieldReportRepository } from './postgres-field-report-repository.js';

const integrationDatabase = resolveIntegrationDatabase();
const origin = 'api:integration:field-reports';

interface SeedScope {
  laboratory_id: string;
  institution_id: string;
  user_id: string;
  catalog_option_id: string;
}

/**
 * Informes são append-only no conteúdo e recusam DELETE: o que esta suíte grava
 * não sai mais do banco. Por isso ela usa ids aleatórios, compara o resumo por
 * diferença (antes/depois) e, no fim, arquiva o equipamento que criou.
 */
describe.skipIf(!integrationDatabase.enabled)('PostgresFieldReportRepository integration', () => {
  let pool: DatabasePool;
  let repository: PostgresFieldReportRepository;
  let seed: SeedScope;
  const equipmentId = randomUUID();
  const otherLaboratoryId = randomUUID();
  const otherEquipmentId = randomUUID();
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  async function summary(): Promise<FieldReportSummary> {
    return summarizeFieldReports(
      seed.laboratory_id,
      await repository.countByKindAndStatus(seed.laboratory_id),
    );
  }

  beforeAll(async () => {
    pool = await connectIntegrationDatabase(integrationDatabase, 4);
    repository = new PostgresFieldReportRepository(pool);

    const seedResult = await pool.query<SeedScope>(
      `SELECT l.id AS laboratory_id, l.institution_id, u.id AS user_id, co.id AS catalog_option_id
         FROM laboratories l
         JOIN users u ON u.institution_id = l.institution_id
          AND u.status = 'ACTIVE' AND u.archived_at IS NULL
         JOIN catalog_options co ON co.laboratory_id = l.id
          AND co.kind IN ('EQUIPMENT_TYPE', 'EQUIPMENT_MODEL')
          AND co.is_selectable IS TRUE AND co.archived_at IS NULL
        WHERE l.code = 'CP2b' AND l.archived_at IS NULL
        ORDER BY u.id, co.id
        LIMIT 1`,
    );
    const found = seedResult.rows[0];
    if (!found) throw new Error('O seed CP2b é necessário para o teste de integração.');
    seed = found;

    await pool.query(
      `INSERT INTO equipment (id, laboratory_id, catalog_option_id, code, name)
       VALUES ($1, $2, $3, $4, 'Equipamento integração informes')`,
      [equipmentId, seed.laboratory_id, seed.catalog_option_id, `FR-INT-${suffix}`],
    );
    // Laboratório B e seu equipamento nunca recebem informe: podem ser apagados.
    await pool.query(
      `INSERT INTO laboratories (id, institution_id, name, code, timezone)
       VALUES ($1, $2, 'Laboratório isolamento informes', $3, 'UTC')`,
      [otherLaboratoryId, seed.institution_id, `FR-B-${suffix}`],
    );
    // A opção do laboratório B aproveita a fonte do catálogo do CP2b: a FK de
    // fonte não é por laboratório, e o que importa aqui é o equipamento de B.
    const otherCatalog = await pool.query<{ id: string }>(
      `INSERT INTO catalog_options (
         laboratory_id, source_id, source_row_id, option_key, kind, code, label, is_selectable
       )
       SELECT $1, source_id, source_row_id, $2, 'EQUIPMENT_TYPE', $2, 'Tipo isolamento informes', true
         FROM catalog_options WHERE id = $3
       RETURNING id`,
      [otherLaboratoryId, `FR-B-TYPE-${suffix}`, seed.catalog_option_id],
    );
    await pool.query(
      `INSERT INTO equipment (id, laboratory_id, catalog_option_id, code, name)
       VALUES ($1, $2, $3, $4, 'Equipamento de outro laboratório')`,
      [otherEquipmentId, otherLaboratoryId, otherCatalog.rows[0]!.id, `FR-B-EQ-${suffix}`],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM equipment WHERE id = $1`, [otherEquipmentId]);
    await pool.query(`DELETE FROM catalog_options WHERE laboratory_id = $1`, [otherLaboratoryId]);
    await pool.query(`DELETE FROM laboratories WHERE id = $1`, [otherLaboratoryId]);
    await pool.query(`UPDATE equipment SET archived_at = now() WHERE id = $1`, [equipmentId]);
    await pool.end();
  });

  it('grava o informe, audita sem o texto e o expõe à revisão com o equipamento', async () => {
    const before = await summary();

    const submitted = await repository.submit(
      {
        laboratoryId: seed.laboratory_id,
        kind: 'EQUIPMENT_PROBLEM',
        equipmentId,
        message: 'Mensagem sigilosa de integração: o detector não liga.',
        blocksUse: true,
        reporterName: 'Aluna Integração',
        reporterContact: 'aluna@unicamp.br',
      },
      { origin, requestId: null },
    );

    const stored = await repository.findActiveById(submitted.id);
    expect(stored).toMatchObject({
      status: 'NEW',
      kind: 'EQUIPMENT_PROBLEM',
      blocksUse: true,
      equipment: { id: equipmentId, code: `FR-INT-${suffix}` },
      reporterName: 'Aluna Integração',
      reviewedBy: null,
    });

    const audit = await pool.query<{ actor_id: string | null; after: Record<string, unknown> }>(
      `SELECT actor_id, after FROM audit_events
        WHERE entity = 'FieldReport' AND entity_id = $1 AND action = 'field-report.submitted'`,
      [submitted.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.actor_id).toBeNull();
    const serialized = JSON.stringify(audit.rows[0]!.after);
    expect(serialized).not.toContain('sigilosa');
    expect(serialized).not.toContain('aluna@unicamp.br');
    expect(serialized).not.toContain('Aluna Integração');

    const after = await summary();
    expect(after.openByKind.EQUIPMENT_PROBLEM).toBe(before.openByKind.EQUIPMENT_PROBLEM + 1);
    expect(after.openBlockingUse).toBe(before.openBlockingUse + 1);
    expect(after.byStatus.NEW).toBe(before.byStatus.NEW + 1);
  });

  it('recusa equipamento de outro laboratório e laboratório inexistente', async () => {
    await expect(
      repository.submit(
        {
          laboratoryId: seed.laboratory_id,
          kind: 'MAINTENANCE_REQUEST',
          equipmentId: otherEquipmentId,
          message: 'Este equipamento não é deste laboratório.',
          blocksUse: false,
          reporterName: null,
          reporterContact: null,
        },
        { origin, requestId: null },
      ),
    ).rejects.toThrow(FieldReportEquipmentMismatchError);

    await expect(
      repository.submit(
        {
          laboratoryId: randomUUID(),
          kind: 'GENERAL_SUPPORT',
          equipmentId: null,
          message: 'Laboratório que não existe no banco.',
          blocksUse: false,
          reporterName: null,
          reporterContact: null,
        },
        { origin, requestId: null },
      ),
    ).rejects.toThrow(FieldReportLaboratoryNotFoundError);
  });

  it('mantém imutável o que foi escrito e recusa DELETE no banco', async () => {
    const { id } = await repository.submit(
      {
        laboratoryId: seed.laboratory_id,
        kind: 'SUPPLY_USAGE',
        equipmentId: null,
        message: 'Usei 50 mL de metanol grau HPLC.',
        blocksUse: false,
        reporterName: null,
        reporterContact: null,
      },
      { origin, requestId: null },
    );

    await expect(
      pool.query(`UPDATE field_reports SET message = 'reescrito pela coordenação' WHERE id = $1`, [id]),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      pool.query(`UPDATE field_reports SET reporter_contact = 'x' WHERE id = $1`, [id]),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(pool.query(`DELETE FROM field_reports WHERE id = $1`, [id])).rejects.toMatchObject({
      code: '55000',
    });
  });

  it('registra a triagem com revisor e audita a transição sem a nota', async () => {
    const { id } = await repository.submit(
      {
        laboratoryId: seed.laboratory_id,
        kind: 'GENERAL_SUPPORT',
        equipmentId: null,
        message: 'Preciso de apoio para calibrar a balança.',
        blocksUse: false,
        reporterName: null,
        reporterContact: null,
      },
      { origin, requestId: null },
    );

    const reviewed = await repository.review(
      id,
      { status: 'IN_REVIEW', reviewNote: 'Nota interna de integração.' },
      { actorId: seed.user_id, origin, requestId: null },
    );
    expect(reviewed).toMatchObject({
      status: 'IN_REVIEW',
      reviewNote: 'Nota interna de integração.',
      reviewedBy: { id: seed.user_id },
    });
    expect(reviewed.reviewedAt).not.toBeNull();

    // Sem `reviewNote`, a nota anterior é preservada.
    const resolved = await repository.review(
      id,
      { status: 'RESOLVED' },
      { actorId: seed.user_id, origin, requestId: null },
    );
    expect(resolved).toMatchObject({ status: 'RESOLVED', reviewNote: 'Nota interna de integração.' });

    const audit = await pool.query<{ actor_id: string; before: unknown; after: unknown }>(
      `SELECT actor_id, before, after FROM audit_events
        WHERE entity = 'FieldReport' AND entity_id = $1 AND action = 'field-report.reviewed'
        ORDER BY occurred_at, id`,
      [id],
    );
    expect(audit.rows.map((row) => [row.before, row.after])).toEqual([
      [{ status: 'NEW' }, { status: 'IN_REVIEW', reviewNoteChanged: true }],
      [{ status: 'IN_REVIEW' }, { status: 'RESOLVED', reviewNoteChanged: false }],
    ]);
    expect(audit.rows.every((row) => row.actor_id === seed.user_id)).toBe(true);
    expect(JSON.stringify(audit.rows)).not.toContain('Nota interna');
  });

  it('lista do mais recente ao mais antigo, filtra e pagina por cursor', async () => {
    const first = await repository.list({
      laboratoryId: seed.laboratory_id,
      kind: 'SUPPLY_USAGE',
      limit: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.items.every((item) => item.kind === 'SUPPLY_USAGE')).toBe(true);

    const all = await repository.list({ laboratoryId: seed.laboratory_id, limit: 50 });
    const timeline = all.items.map((item) => item.createdAt);
    expect([...timeline].sort().reverse()).toEqual(timeline);

    if (all.pageInfo.nextCursor !== null) {
      const next = await repository.list({
        laboratoryId: seed.laboratory_id,
        cursor: all.pageInfo.nextCursor,
        limit: 50,
      });
      const seen = new Set(all.items.map((item) => item.id));
      expect(next.items.some((item) => seen.has(item.id))).toBe(false);
    }
  });

  it('o formulário público lista o equipamento ativo e recusa laboratório inexistente', async () => {
    const form = await repository.findPublicForm(seed.laboratory_id);
    expect(form?.equipment.some((item) => item.id === equipmentId)).toBe(true);
    expect(form?.equipment.some((item) => item.id === otherEquipmentId)).toBe(false);
    await expect(repository.findPublicForm(randomUUID())).resolves.toBeNull();
  });
});
