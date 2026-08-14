import type { AuthenticatedPrincipal, Laboratory, ManagementAnalytics } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManagementPageClient } from './management-page-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}));

const now = '2026-08-14T00:00:00.000Z';
const laboratory: Laboratory = {
  id: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  institutionId: '6ba7b811-9dad-11d1-b245-5ffdce74fad2',
  name: 'Laboratório CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const principal = {
  user: {
    id: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    institutionId: laboratory.institutionId,
    name: 'Lucas Nakamura',
    email: 'lucas@unicamp.br',
    supervisorUserId: null,
    status: 'ACTIVE',
    identityProvider: 'LOCAL',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
  memberships: [
    {
      id: 'm1',
      userId: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
      laboratoryId: laboratory.id,
      role: 'TECNICO',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
  ],
  systemRoles: [],
} satisfies AuthenticatedPrincipal;

const mockAnalytics: ManagementAnalytics = {
  laboratoryId: laboratory.id,
  timezone: 'America/Sao_Paulo',
  period: {
    startsAt: '2026-07-15T00:00:00.000Z',
    endsAt: '2026-08-14T00:00:00.000Z',
  },
  equipmentMetrics: {
    totalActiveEquipment: 4,
    totalReservedHours: 62.5,
    reservationCount: 15,
  },
  inventoryMetrics: {
    totalActiveBatches: 10,
    lowStockProductsCount: 1,
    expiringBatchesCount: 0,
    totalWithdrawalsCount: 8,
  },
  generatedAt: now,
};

const mockProjectUsagePage = {
  items: [
    {
      projectId: 'proj-1',
      projectCode: 'PROJ-01',
      projectName: 'Projeto Síntese Orgânica',
      reservedHours: 30,
      reservationCount: 8,
      withdrawalCount: 4,
      consumedProducts: [
        {
          productId: 'p1',
          productCode: 'ACT-PA',
          productName: 'Acetona PA',
          unitOfMeasure: 'ML' as const,
          totalQuantity: 2000,
        },
      ],
    },
  ],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('ManagementPageClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders management analytics metrics and project usage breakdown', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/management/analytics?')) return json(mockAnalytics);
      if (url.startsWith('/api/management/project-usage?')) return json(mockProjectUsagePage);
      if (url.startsWith('/api/management/audit-logs?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<ManagementPageClient />);

    expect(await screen.findByRole('heading', { name: 'Indicadores, Analytics & Auditoria' })).toBeInTheDocument();
    expect(await screen.findByText('62.5h')).toBeInTheDocument();


    expect(screen.getByText('Projeto Síntese Orgânica')).toBeInTheDocument();
    expect(screen.getByText(/Acetona PA/)).toBeInTheDocument();
  });
});
