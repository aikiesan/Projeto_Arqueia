import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MorePageClient } from './more-page-client';

let mockSearchParams = new URLSearchParams();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockSearchParams,
}));

const metadata = {
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  archivedAt: null,
} as const;

const lab1: Laboratory = {
  ...metadata,
  id: '11111111-1111-4111-a111-111111111111',
  institutionId: '22222222-2222-4222-a222-222222222222',
  name: 'Laboratório CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
};

const lab2: Laboratory = {
  ...metadata,
  id: '33333333-3333-4333-a333-333333333333',
  institutionId: lab1.institutionId,
  name: 'Laboratório Multiusuário',
  code: 'LMU',
  timezone: 'America/Manaus',
};

function principal(admin = false): AuthenticatedPrincipal {
  return {
    user: {
      ...metadata,
      id: '44444444-4444-4444-a444-444444444444',
      institutionId: lab1.institutionId,
      name: 'Maria Pesquisadora',
      email: 'maria@example.com',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
    },
    memberships: [
      {
        ...metadata,
        id: 'membership-1',
        userId: '44444444-4444-4444-a444-444444444444',
        laboratoryId: lab1.id,
        role: 'USUARIO',
      },
    ],
    systemRoles: admin
      ? [
          {
            ...metadata,
            id: 'system-role-1',
            userId: '44444444-4444-4444-a444-444444444444',
            role: 'ADMIN',
          },
        ]
      : [],
  };
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockPageFetch(user = principal(), laboratories: readonly Laboratory[] = [lab1, lab2]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/session') return json({ principal: user });
    if (url === '/api/laboratories') return json(laboratories);
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('MorePageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('torna o destino Mais existente e ativo na navegação mobile', async () => {
    mockPageFetch();
    render(<MorePageClient />);

    expect(await screen.findByRole('heading', { name: 'Mais opções' })).toBeInTheDocument();
    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(mobileNavigation).getByRole('link', { name: 'Mais' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('mostra somente os módulos presentes na apresentação do usuário comum', async () => {
    mockPageFetch();
    render(<MorePageClient />);

    const modules = await screen.findByRole('region', { name: 'Outros módulos' });
    expect(within(modules).getByRole('link', { name: /Equipamentos/i })).toBeInTheDocument();
    expect(within(modules).getByRole('link', { name: /Guia de Uso/i })).toBeInTheDocument();
    expect(within(modules).queryByRole('link', { name: /Usuários/i })).not.toBeInTheDocument();
    expect(within(modules).queryByRole('link', { name: /Gestão/i })).not.toBeInTheDocument();

    const account = screen.getByRole('region', { name: 'Seu acesso' });
    expect(within(account).getByRole('link', { name: /Perfil/i })).toHaveAttribute('href', '/perfil');
    expect(within(account).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('expõe atalhos adicionais quando a apresentação autorizada os contém', async () => {
    mockPageFetch(principal(true));
    render(<MorePageClient />);

    const modules = await screen.findByRole('region', { name: 'Outros módulos' });
    expect(within(modules).getByRole('link', { name: /Usuários/i })).toBeInTheDocument();
    expect(within(modules).getByRole('link', { name: /Gestão/i })).toBeInTheDocument();
  });

  it('respeita o laboratório da URL e preserva o contexto nos atalhos', async () => {
    mockSearchParams = new URLSearchParams({ laboratory: lab2.id });
    mockPageFetch(principal(true));
    render(<MorePageClient />);

    const laboratories = await screen.findByRole('region', { name: 'Laboratório ativo' });
    expect(within(laboratories).getByRole('link', { name: /Laboratório Multiusuário/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const modules = screen.getByRole('region', { name: 'Outros módulos' });
    expect(within(modules).getByRole('link', { name: /Equipamentos/i })).toHaveAttribute(
      'href',
      `/equipamentos?laboratory=${lab2.id}`,
    );
    expect(screen.getByRole('link', { name: 'Ler QR Code' })).toHaveAttribute(
      'href',
      `/qr?laboratory=${lab2.id}`,
    );
  });

  it('oferece retry recuperável quando o carregamento falha', async () => {
    let shouldFail = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (shouldFail) return json({ message: 'Serviço temporariamente indisponível.' }, 503);
      const url = String(input);
      if (url === '/api/session') return json({ principal: principal() });
      if (url === '/api/laboratories') return json([lab1]);
      throw new Error(`URL inesperada: ${url}`);
    });
    render(<MorePageClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço temporariamente indisponível.');
    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Mais opções' })).toBeInTheDocument();
  });

  it.each([390, 1440])('mantém a estrutura do hub no viewport de %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true });
    window.dispatchEvent(new Event('resize'));
    mockPageFetch();
    const { container } = render(<MorePageClient />);

    await waitFor(() => expect(container.querySelector('.more-module-grid')).toBeInTheDocument());
    expect(container.querySelector('.more-laboratory-list')).toBeInTheDocument();
    expect(container.querySelector('.more-account-actions')).toBeInTheDocument();
  });
});
