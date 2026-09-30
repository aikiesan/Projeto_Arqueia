import { describe, expect, it } from 'vitest';

import {
  LABORATORY_ROLE_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from '../identity/permissions.js';
import {
  FIELD_REPORT_MESSAGE_MAX_LENGTH,
  fieldReportReference,
  fieldReportSchema,
  fieldReportSummarySchema,
  listFieldReportsQuerySchema,
  publicFieldReportEquipmentSchema,
  publicFieldReportFormSchema,
  reviewFieldReportInputSchema,
  submitFieldReportInputSchema,
  submitFieldReportResultSchema,
} from './field-report.js';

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const equipmentId = '22222222-2222-4222-a222-222222222222';
const fieldReportId = '3a4b5c6d-3333-4333-a333-333333333333';

const validSubmission = {
  laboratoryId,
  kind: 'EQUIPMENT_PROBLEM',
  message: 'A bomba do HPLC está fazendo um barulho estranho.',
} as const;

describe('Contrato de informes — envio público', () => {
  /**
   * Este schema é o que a internet aberta pode gravar. Status, nota de revisão
   * ou revisor nunca podem entrar por aqui: se alguém ampliar o schema, cai.
   */
  it('aceita apenas os campos do formulário', () => {
    expect(Object.keys(submitFieldReportInputSchema.shape).sort()).toEqual([
      'blocksUse',
      'equipmentId',
      'kind',
      'laboratoryId',
      'message',
      'reporterContact',
      'reporterName',
    ]);
  });

  it.each([
    ['status', 'RESOLVED'],
    ['reviewNote', 'forjado'],
    ['reviewedBy', { id: equipmentId, name: 'x' }],
    ['id', fieldReportId],
  ])('recusa o campo de revisão %s enxertado no envio', (field, value) => {
    const parsed = submitFieldReportInputSchema.safeParse({ ...validSubmission, [field]: value });
    expect(parsed.success).toBe(false);
  });

  it('preenche padrões e transforma identificação vazia em null', () => {
    const parsed = submitFieldReportInputSchema.parse({
      ...validSubmission,
      reporterName: '   ',
      reporterContact: '',
    });

    expect(parsed).toEqual({
      ...validSubmission,
      equipmentId: null,
      blocksUse: false,
      reporterName: null,
      reporterContact: null,
    });
  });

  it('apara a mensagem e a identificação informadas', () => {
    const parsed = submitFieldReportInputSchema.parse({
      ...validSubmission,
      message: '   Acabou o metanol grau HPLC.   ',
      reporterName: '  Ana  ',
      reporterContact: ' ana@unicamp.br ',
    });

    expect(parsed.message).toBe('Acabou o metanol grau HPLC.');
    expect(parsed.reporterName).toBe('Ana');
    expect(parsed.reporterContact).toBe('ana@unicamp.br');
  });

  it('exige uma mensagem com conteúdo e respeita o teto', () => {
    expect(
      submitFieldReportInputSchema.safeParse({ ...validSubmission, message: '   curto   ' }).success,
    ).toBe(false);
    expect(
      submitFieldReportInputSchema.safeParse({
        ...validSubmission,
        message: 'x'.repeat(FIELD_REPORT_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it.each(['EQUIPMENT_PROBLEM', 'MAINTENANCE_REQUEST', 'SUPPLY_USAGE', 'GENERAL_SUPPORT'])(
    'aceita o tipo %s',
    (kind) => {
      expect(submitFieldReportInputSchema.safeParse({ ...validSubmission, kind }).success).toBe(true);
    },
  );

  it('recusa tipo desconhecido e laboratório que não é uuid', () => {
    expect(
      submitFieldReportInputSchema.safeParse({ ...validSubmission, kind: 'SPAM' }).success,
    ).toBe(false);
    expect(
      submitFieldReportInputSchema.safeParse({ ...validSubmission, laboratoryId: 'CP2b' }).success,
    ).toBe(false);
  });

  it('devolve só protocolo e horário a quem enviou', () => {
    expect(Object.keys(submitFieldReportResultSchema.shape).sort()).toEqual([
      'receivedAt',
      'reference',
    ]);
  });
});

describe('Contrato de informes — formulário público', () => {
  it('expõe do equipamento apenas id, código e nome', () => {
    expect(Object.keys(publicFieldReportEquipmentSchema.shape).sort()).toEqual([
      'code',
      'id',
      'name',
    ]);
  });

  it('recusa dados internos enxertados no equipamento', () => {
    const parsed = publicFieldReportFormSchema.safeParse({
      laboratory: { id: laboratoryId, code: 'CP2b', name: 'CP2b' },
      equipment: [{ id: equipmentId, code: 'HPLC-01', name: 'HPLC', notes: 'interno' }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('Contrato de informes — revisão', () => {
  it('deriva o protocolo legível do id', () => {
    expect(fieldReportReference(fieldReportId)).toBe('INF-3A4B5C6D');
  });

  it('valida o informe completo que só a coordenação lê', () => {
    const report = {
      id: fieldReportId,
      laboratoryId,
      reference: 'INF-3A4B5C6D',
      kind: 'SUPPLY_USAGE',
      status: 'NEW',
      equipment: null,
      message: 'Usei 20 mL de acetonitrila.',
      blocksUse: false,
      reporterName: null,
      reporterContact: null,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: '2026-09-30T12:00:00.000Z',
      updatedAt: '2026-09-30T12:00:00.000Z',
      archivedAt: null,
    };
    expect(fieldReportSchema.parse(report)).toEqual(report);
  });

  it('aceita somente status conhecidos na triagem e limpa nota vazia', () => {
    expect(reviewFieldReportInputSchema.parse({ status: 'IN_REVIEW', reviewNote: '' })).toEqual({
      status: 'IN_REVIEW',
      reviewNote: null,
    });
    expect(reviewFieldReportInputSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
    expect(
      reviewFieldReportInputSchema.safeParse({ status: 'RESOLVED', message: 'reescrito' }).success,
    ).toBe(false);
  });

  it('limita a página de listagem a 50 itens e converte o limite da query string', () => {
    expect(listFieldReportsQuerySchema.parse({ laboratoryId, limit: '10' }).limit).toBe(10);
    expect(listFieldReportsQuerySchema.safeParse({ laboratoryId, limit: '51' }).success).toBe(false);
  });

  it('compila contagens por tipo e por status', () => {
    const summary = fieldReportSummarySchema.parse({
      laboratoryId,
      openByKind: {
        EQUIPMENT_PROBLEM: 2,
        MAINTENANCE_REQUEST: 1,
        SUPPLY_USAGE: 0,
        GENERAL_SUPPORT: 3,
      },
      byStatus: { NEW: 4, IN_REVIEW: 2, RESOLVED: 7 },
      openBlockingUse: 1,
    });
    expect(summary.byStatus.RESOLVED).toBe(7);
  });
});

describe('Quem revisa informes (papel × laboratório)', () => {
  /**
   * Alunos e pós-docs compartilham o papel USUARIO ("Usuário Pesquisador"). O
   * que distingue a coordenação é GESTOR_ACESSO_CP2B (ADR-009). Os informes não
   * podem ficar visíveis para alunos: se alguém der a permissão a USUARIO, cai.
   */
  it('concede a revisão à coordenação e ao administrador, nunca ao usuário comum', () => {
    const reviewers = Object.entries(LABORATORY_ROLE_PERMISSIONS)
      .filter(([, permissions]) =>
        (permissions as readonly string[]).includes('field-report.review'),
      )
      .map(([role]) => role);

    expect(reviewers).toEqual(['GESTOR_ACESSO_CP2B']);
    expect(SYSTEM_ROLE_PERMISSIONS.ADMIN).toContain('field-report.review');
  });
});
