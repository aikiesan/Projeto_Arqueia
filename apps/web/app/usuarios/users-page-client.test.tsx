import type { AuthenticatedPrincipal, Laboratory, User } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsersPageClient } from './users-page-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }));

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
    loginCode: 'ARQ-LUCAS-001',
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
  systemRoles: [{ id: 'sr1', userId: '6ba7b810-9dad-11d1-b245-5ffdce74fad2', role: 'ADMIN', createdAt: now, updatedAt: now, archivedAt: null }],
} satisfies AuthenticatedPrincipal;

const userList: User[] = [
  principal.user,
  {
    id: 'user-2',
    institutionId: laboratory.institutionId,
    loginCode: 'ARQ-MARIANA-002',
    academicCategory: 'DOUTORADO',
    status: 'ACTIVE',
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
];

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('UsersPageClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders users list and action buttons correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url === '/api/users') return json(userList);
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<UsersPageClient />);

    expect(await screen.findByRole('heading', { name: 'Equipe & Controle de Acessos' })).toBeInTheDocument();
    expect(screen.getAllByText('ARQ-LUCAS-001').length).toBeGreaterThan(0);
    expect(screen.getByText('ARQ-MARIANA-002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo Usuário' })).toBeInTheDocument();

  });

  it('loads current roles and revokes access with password confirmation', async () => {
    let accessActive = true;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url === '/api/users') return json(userList);
      if (url.startsWith('/api/access?userId=')) {
        return json({
          memberships: accessActive ? principal.memberships : [],
          systemRoles: [],
        });
      }
      if (url === `/api/access/memberships/${principal.memberships[0]!.id}` && init?.method === 'DELETE') {
        accessActive = false;
        return json({ ...principal.memberships[0], archivedAt: now });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<UsersPageClient />);
    await screen.findByRole('heading', { name: 'Equipe & Controle de Acessos' });
    fireEvent.click(screen.getAllByRole('button', { name: /Permiss/ })[0]!);

    expect(await screen.findByText('Técnico de Laboratório', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Confirme sua senha/), {
      target: { value: 'current-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/access/memberships/${principal.memberships[0]!.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    ));
    expect(await screen.findByText('Nenhum papel atribuído.')).toBeInTheDocument();
  });
});
