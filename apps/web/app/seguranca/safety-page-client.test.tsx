import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SafetyPageClient } from './safety-page-client';

let mockSearchParams = new URLSearchParams();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockSearchParams,
}));

const metadata = {
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
} as const;

const cp2b: Laboratory = {
  ...metadata,
  id: '11111111-1111-4111-a111-111111111111',
  institutionId: '22222222-2222-4222-a222-222222222222',
  name: 'Laboratório CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
};

const lmu: Laboratory = { ...cp2b, id: '33333333-3333-4333-a333-333333333333', code: 'LMU', name: 'Laboratório Multiusuário' };

const principal: AuthenticatedPrincipal = {
  user: {
    ...metadata,
    id: '44444444-4444-4444-a444-444444444444',
    institutionId: cp2b.institutionId,
    loginCode: 'ARQ-ALUNO-01',
    name: 'Aluna Teste',
    email: 'aluna@unicamp.br',
    academicCategory: 'MESTRADO',
    status: 'ACTIVE',
    mustChangePassword: false,
  },
  memberships: [
    {
      ...metadata,
      id: '55555555-5555-4555-a555-555555555555',
      userId: '44444444-4444-4444-a444-444444444444',
      laboratoryId: cp2b.id,
      role: 'USUARIO',
    },
  ],
  systemRoles: [],
};

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockPageFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/session') return json({ principal });
    if (url === '/api/laboratories') return json([cp2b, lmu]);
    // O sino de quem não revisa informes não busca nada; qualquer outra URL é erro do teste.
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('SafetyPageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('é um item próprio do menu lateral, ativo nesta página, com o guia completo', async () => {
    mockPageFetch();
    render(<SafetyPageClient />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Boas Práticas de Laboratório' })).toBeInTheDocument();
    const modules = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(modules).getByRole('link', { name: /Boas Práticas/ })).toHaveAttribute('aria-current', 'page');
    expect(within(modules).getByRole('link', { name: /Guia de Uso/ })).not.toHaveAttribute('aria-current');

    expect(screen.getByRole('heading', { level: 3, name: 'Em caso de acidente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(19) 3521-6000' })).toHaveAttribute('href', 'tel:+551935216000');
    expect(screen.getByRole('link', { name: 'Boas práticas (página pública)' })).toHaveAttribute(
      'href',
      '/boas-praticas',
    );
  });

  it('respeita o laboratório da URL: "Avisar a coordenação" já abre o Informar nele', async () => {
    mockSearchParams = new URLSearchParams({ laboratory: lmu.id });
    mockPageFetch();
    render(<SafetyPageClient />);

    expect(await screen.findByRole('link', { name: /Avisar a coordenação/ })).toHaveAttribute(
      'href',
      `/informar?laboratory=${lmu.id}`,
    );
    const modules = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(modules).getByRole('link', { name: /Boas Práticas/ })).toHaveAttribute(
      'href',
      `/seguranca?laboratory=${lmu.id}`,
    );
  });

  it('sem sessão, volta para o login', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ message: 'Sessão expirada.' }, 401));
    render(<SafetyPageClient />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });
});
