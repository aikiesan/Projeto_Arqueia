import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuidePageClient } from './guide-page-client';

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
const principal: AuthenticatedPrincipal = {
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
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('GuidePageClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders guide page editorial metadata and navigation tabs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<GuidePageClient />);

    expect(await screen.findByRole('heading', { name: 'Guia de Uso do Projeto Arqueia' })).toBeInTheDocument();
    expect(screen.getByText(/Versão do Guia:/)).toBeInTheDocument();
    expect(screen.getByText('1. Visão Geral & Filosofia')).toBeInTheDocument();
  });
});
