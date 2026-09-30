import type {
  AuthenticatedPrincipal,
  FieldReport,
  FieldReportSummary,
  Laboratory,
  LaboratoryRole,
} from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FieldReportsPageClient } from './field-reports-page-client';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const metadata = {
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  archivedAt: null,
} as const;

const lab: Laboratory = {
  ...metadata,
  id: '11111111-1111-4111-a111-111111111111',
  institutionId: '22222222-2222-4222-a222-222222222222',
  name: 'Laboratório CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
};

function principal(role: LaboratoryRole): AuthenticatedPrincipal {
  return {
    user: {
      ...metadata,
      id: '44444444-4444-4444-a444-444444444444',
      institutionId: lab.institutionId,
      loginCode: 'ARQ-LUCAS-001',
      name: 'Coordenação CP2b',
      email: 'coordenacao@unicamp.br',
      academicCategory: 'POS_DOUTORADO',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
    memberships: [
      {
        ...metadata,
        id: '55555555-5555-4555-a555-555555555555',
        userId: '44444444-4444-4444-a444-444444444444',
        laboratoryId: lab.id,
        role,
      },
    ],
    systemRoles: [],
  };
}

const report: FieldReport = {
  ...metadata,
  id: '6a7b8c9d-6666-4666-a666-666666666666',
  laboratoryId: lab.id,
  reference: 'INF-6A7B8C9D',
  kind: 'EQUIPMENT_PROBLEM',
  status: 'NEW',
  equipment: { id: '77777777-7777-4777-a777-777777777777', code: 'HPLC-01', name: 'HPLC Shimadzu' },
  message: 'O HPLC mostra erro de pressão ao iniciar.',
  blocksUse: true,
  reporterName: null,
  reporterContact: null,
  reviewNote: null,
  reviewedBy: null,
  reviewedAt: null,
};

const summary: FieldReportSummary = {
  laboratoryId: lab.id,
  openByKind: { EQUIPMENT_PROBLEM: 1, MAINTENANCE_REQUEST: 0, SUPPLY_USAGE: 2, GENERAL_SUPPORT: 0 },
  byStatus: { NEW: 3, IN_REVIEW: 0, RESOLVED: 4 },
  openBlockingUse: 1,
};

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockFetch(user: AuthenticatedPrincipal) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/session') return json({ principal: user });
    if (url === '/api/laboratories') return json([lab]);
    if (url === `/api/field-reports/summary?laboratoryId=${lab.id}`) return json(summary);
    if (url.startsWith('/api/field-reports?')) {
      return json({ items: [report], pageInfo: { hasNextPage: false, nextCursor: null } });
    }
    if (url === `/api/field-reports/${report.id}` && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { status: FieldReport['status']; reviewNote: string | null };
      return json({
        ...report,
        status: body.status,
        reviewNote: body.reviewNote,
        reviewedBy: { id: user.user.id, name: user.user.name },
        reviewedAt: '2026-09-30T13:00:00.000Z',
      });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('FieldReportsPageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra à coordenação o compilado por tipo e os informes novos', async () => {
    const fetchMock = mockFetch(principal('GESTOR_ACESSO_CP2B'));
    render(<FieldReportsPageClient />);

    const summaryRegion = await screen.findByRole('region', { name: 'Resumo dos informes em aberto' });
    expect(
      await within(summaryRegion).findByRole('button', { name: /2\s*Uso de insumos/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('O HPLC mostra erro de pressão ao iniciar.')).toBeInTheDocument();
    expect(screen.getByText('Impede o uso')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 informe em aberto');
    expect(screen.getByRole('link', { name: /Informes/ })).toHaveAttribute('aria-current', 'page');

    const listCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith('/api/field-reports?'));
    expect(String(listCall?.[0])).toContain('status=NEW');
  });

  it('registra a triagem com a nota da coordenação', async () => {
    const fetchMock = mockFetch(principal('GESTOR_ACESSO_CP2B'));
    render(<FieldReportsPageClient />);

    fireEvent.change(await screen.findByRole('textbox', { name: /Nota da coordenação/ }), {
      target: { value: 'Técnico avisado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar análise' }));

    await waitFor(() => expect(screen.getByText(/agora está “Em análise”/)).toBeInTheDocument());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      status: 'IN_REVIEW',
      reviewNote: 'Técnico avisado.',
    });
  });

  it('não busca informes para quem não é da coordenação', async () => {
    const fetchMock = mockFetch(principal('USUARIO'));
    render(<FieldReportsPageClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent('visíveis só para a coordenação');
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/field-reports')),
    ).toBe(false);
    expect(screen.queryByRole('link', { name: /Informes/ })).not.toBeInTheDocument();
  });
});
