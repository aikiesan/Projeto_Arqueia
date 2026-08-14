import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryPageClient } from './inventory-page-client';

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

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('InventoryPageClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders inventory toolbar and empty state when no batches exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/inventory/products?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url.startsWith('/api/inventory/batches?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/projects') return json([]);
      if (url.startsWith('/api/catalog/options?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<InventoryPageClient />);

    expect(await screen.findByRole('heading', { name: 'Estoque & Livro-Razão de Insumos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nenhum lote de insumo encontrado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo Produto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrada de Lote' })).toBeInTheDocument();
  });
});
