import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuidePageClient } from './guide-page-client';

const replace = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace }),
  useSearchParams: () => mockSearchParams,
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
    loginCode: 'ARQ-LUCAS-001',
    name: 'Usuário Unicamp',
    email: 'usuario@unicamp.br',
    academicCategory: 'PESQUISADOR',
    status: 'ACTIVE',
    mustChangePassword: false,
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

function mockGuideFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/session') return json({ principal });
    if (url === '/api/laboratories') return json([laboratory]);
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('GuidePageClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('abre direto na aba de boas práticas pelo link ?secao=boas-praticas', async () => {
    mockSearchParams = new URLSearchParams({ secao: 'boas-praticas' });
    mockGuideFetch();

    render(<GuidePageClient />);

    expect(
      await screen.findByRole('heading', { level: 3, name: '9. Boas Práticas de Laboratório' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Antes de entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/boas-praticas' })).toHaveAttribute('href', '/boas-praticas');
  });

  it('ignora seção desconhecida na URL e abre a visão geral', async () => {
    mockSearchParams = new URLSearchParams({ secao: 'nao-existe' });
    mockGuideFetch();

    render(<GuidePageClient />);

    expect(await screen.findByText(/1\. Visão Geral & Arquitetura/)).toBeInTheDocument();
  });

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
