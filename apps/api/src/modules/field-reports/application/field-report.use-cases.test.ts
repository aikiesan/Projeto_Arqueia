import type {
  AuthenticatedPrincipal,
  FieldReport,
  ParsedSubmitFieldReportInput,
} from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import {
  FieldReportLaboratoryNotFoundError,
  FieldReportNotFoundError,
} from '../domain/field-report.errors.js';
import type {
  FieldReportReviewRepository,
  PublicFieldReportGateway,
} from '../domain/ports/field-report-repository.port.js';
import { GetPublicFieldReportFormUseCase } from './get-public-field-report-form.use-case.js';
import { ListFieldReportsUseCase } from './list-field-reports.use-case.js';
import { ReviewFieldReportUseCase } from './review-field-report.use-case.js';
import { SubmitFieldReportUseCase } from './submit-field-report.use-case.js';
import { SummarizeFieldReportsUseCase } from './summarize-field-reports.use-case.js';

const labA = '11111111-1111-4111-a111-111111111111';
const labB = '22222222-2222-4222-a222-222222222222';
const userId = '44444444-4444-4444-a444-444444444444';
const fieldReportId = '5a6b7c8d-5555-4555-a555-555555555555';
const now = '2026-09-30T12:00:00.000Z';
const context = { origin: 'api:test', requestId: null };

type Role = 'USUARIO' | 'GESTOR_ACESSO_CP2B' | 'TECNICO' | 'ADMIN';

function principal(role: Role, laboratoryId = labA): AuthenticatedPrincipal {
  const isAdmin = role === 'ADMIN';
  return {
    user: {
      id: userId,
      institutionId: '66666666-6666-4666-a666-666666666666',
      loginCode: 'ARQ-TESTE-01',
      name: 'Pessoa Teste',
      email: 'pessoa@unicamp.br',
      academicCategory: 'POS_DOUTORADO',
      status: 'ACTIVE',
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    memberships: isAdmin
      ? []
      : [
          {
            id: '77777777-7777-4777-a777-777777777777',
            userId,
            laboratoryId,
            role,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ],
    systemRoles: isAdmin
      ? [
          {
            id: '88888888-8888-4888-a888-888888888888',
            userId,
            role: 'ADMIN',
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ]
      : [],
  } as AuthenticatedPrincipal;
}

const report = { id: fieldReportId, laboratoryId: labA, status: 'NEW' } as FieldReport;

function reviewRepository(
  overrides: Partial<FieldReportReviewRepository> = {},
): FieldReportReviewRepository {
  return {
    list: vi.fn().mockResolvedValue({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    countByKindAndStatus: vi.fn().mockResolvedValue([]),
    findActiveById: vi.fn().mockResolvedValue(report),
    review: vi.fn().mockResolvedValue({ ...report, status: 'IN_REVIEW' }),
    ...overrides,
  };
}

function gateway(overrides: Partial<PublicFieldReportGateway> = {}): PublicFieldReportGateway {
  return {
    findPublicForm: vi.fn().mockResolvedValue(null),
    submit: vi.fn().mockResolvedValue({ id: fieldReportId, createdAt: now }),
    ...overrides,
  };
}

const permissions = new PermissionEvaluator();

describe('Envio público de informes', () => {
  const input: ParsedSubmitFieldReportInput = {
    laboratoryId: labA,
    kind: 'MAINTENANCE_REQUEST',
    equipmentId: null,
    message: 'A capela precisa de manutenção no exaustor.',
    blocksUse: false,
    reporterName: null,
    reporterContact: null,
  };

  it('grava sem principal e devolve só protocolo e horário', async () => {
    const reports = gateway();

    const result = await new SubmitFieldReportUseCase(reports).execute(input, context);

    expect(reports.submit).toHaveBeenCalledWith(input, context);
    expect(result).toEqual({ reference: 'INF-5A6B7C8D', receivedAt: now });
  });

  it('recusa formulário de laboratório inexistente ou arquivado', async () => {
    await expect(new GetPublicFieldReportFormUseCase(gateway()).execute(labA)).rejects.toThrow(
      FieldReportLaboratoryNotFoundError,
    );
  });
});

describe('Leitura de informes — só a coordenação do laboratório', () => {
  it.each<Role>(['GESTOR_ACESSO_CP2B', 'ADMIN'])('%s lista os informes do laboratório', async (role) => {
    const reports = reviewRepository();

    await new ListFieldReportsUseCase(reports, permissions).execute(principal(role), {
      laboratoryId: labA,
      limit: 25,
    });

    expect(reports.list).toHaveBeenCalledOnce();
  });

  it.each<Role>(['USUARIO', 'TECNICO'])('%s não lê informes e o banco nem é consultado', async (role) => {
    const reports = reviewRepository();

    await expect(
      new ListFieldReportsUseCase(reports, permissions).execute(principal(role), {
        laboratoryId: labA,
        limit: 25,
      }),
    ).rejects.toThrow(AuthorizationDeniedError);
    expect(reports.list).not.toHaveBeenCalled();
  });

  it('a coordenação de um laboratório não lê informes de outro', async () => {
    const reports = reviewRepository();

    await expect(
      new SummarizeFieldReportsUseCase(reports, permissions).execute(
        principal('GESTOR_ACESSO_CP2B', labB),
        labA,
      ),
    ).rejects.toThrow(AuthorizationDeniedError);
    expect(reports.countByKindAndStatus).not.toHaveBeenCalled();
  });

  it('compila o resumo a partir das contagens do repositório', async () => {
    const reports = reviewRepository({
      countByKindAndStatus: vi
        .fn()
        .mockResolvedValue([{ kind: 'SUPPLY_USAGE', status: 'NEW', blocksUse: false, count: 2 }]),
    });

    const summary = await new SummarizeFieldReportsUseCase(reports, permissions).execute(
      principal('GESTOR_ACESSO_CP2B'),
      labA,
    );

    expect(summary.openByKind.SUPPLY_USAGE).toBe(2);
    expect(summary.byStatus.NEW).toBe(2);
  });
});

describe('Triagem de informes', () => {
  it('autoriza pelo laboratório do próprio informe e registra o revisor', async () => {
    const reports = reviewRepository();

    await new ReviewFieldReportUseCase(reports, permissions).execute(
      principal('GESTOR_ACESSO_CP2B'),
      fieldReportId,
      { status: 'IN_REVIEW', reviewNote: 'Técnico avisado.' },
      context,
    );

    expect(reports.review).toHaveBeenCalledWith(
      fieldReportId,
      { status: 'IN_REVIEW', reviewNote: 'Técnico avisado.' },
      { ...context, actorId: userId },
    );
  });

  it('nega a triagem a quem coordena outro laboratório', async () => {
    const reports = reviewRepository();

    await expect(
      new ReviewFieldReportUseCase(reports, permissions).execute(
        principal('GESTOR_ACESSO_CP2B', labB),
        fieldReportId,
        { status: 'RESOLVED' },
        context,
      ),
    ).rejects.toThrow(AuthorizationDeniedError);
    expect(reports.review).not.toHaveBeenCalled();
  });

  it('informa quando o informe não existe', async () => {
    const reports = reviewRepository({ findActiveById: vi.fn().mockResolvedValue(null) });

    await expect(
      new ReviewFieldReportUseCase(reports, permissions).execute(
        principal('ADMIN'),
        fieldReportId,
        { status: 'RESOLVED' },
        context,
      ),
    ).rejects.toThrow(FieldReportNotFoundError);
  });
});
