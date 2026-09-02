import type { AuthenticatedPrincipal, Batch, Laboratory, Product } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InventoryPageClient } from './inventory-page-client';

const replace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace }),
  useSearchParams: () => mockSearchParams,
}));

const now = '2026-08-14T00:00:00.000Z';
const laboratory: Laboratory = {
  archivedAt: null,
  code: 'CP2b',
  createdAt: now,
  id: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  institutionId: '6ba7b811-9dad-11d1-b245-5ffdce74fad2',
  name: 'Laboratório CP2b',
  timezone: 'America/Sao_Paulo',
  updatedAt: now,
};

const principal: AuthenticatedPrincipal = {
  memberships: [
    {
      archivedAt: null,
      createdAt: now,
      id: 'm1',
      laboratoryId: laboratory.id,
      role: 'TECNICO',
      updatedAt: now,
      userId: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    },
  ],
  systemRoles: [],
  user: {
    archivedAt: null,
    createdAt: now,
    loginCode: 'ARQ-LUCAS-001',
    id: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    academicCategory: 'PESQUISADOR',
    institutionId: laboratory.institutionId,
    mustChangePassword: false,
    status: 'ACTIVE',
    updatedAt: now,
  },
};

const mockProduct: Product = {
  archivedAt: null,
  casNumber: '77-92-9',
  category: 'REAGENT',
  code: 'PRD-CITRATO',
  createdAt: now,
  description: null,
  id: 'p1',
  laboratoryId: laboratory.id,
  minimumStockThreshold: 10,
  name: 'Ácido Cítrico Anidro',
  unitOfMeasure: 'G',
  updatedAt: now,
};

const mockBatch: Batch = {
  archivedAt: null,
  batchNumber: 'LOTE-2026-CITRATO',
  benchOptionId: null,
  createdAt: now,
  currentBalance: 500,
  expirationDate: '2027-12-31T00:00:00.000Z',
  id: 'b1',
  initialQuantity: 1000,
  laboratoryId: laboratory.id,
  manufacturer: 'Sigma-Aldrich',
  notes: null,
  productId: mockProduct.id,
  qrCode: 'ARQ-CP2B-PRD-CITRATO-FE-01',
  receivedDate: '2026-01-01T00:00:00.000Z',
  spaceOptionId: null,
  status: 'AVAILABLE',
  updatedAt: now,
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('InventoryPageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('renders batches and opens withdrawal modal when ?batch= and ?action=withdraw are passed', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'withdraw',
      batch: 'b1',
      laboratory: laboratory.id,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/inventory/products?')) {
        return json({ items: [mockProduct], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url.startsWith('/api/inventory/batches?')) {
        return json({ items: [mockBatch], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/projects') return json([]);
      if (url.startsWith('/api/catalog/options?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<InventoryPageClient />);

    expect(await screen.findByRole('heading', { name: 'Retirada Rápida de Insumo' })).toBeInTheDocument();
    expect(screen.getAllByText(/LOTE-2026-CITRATO/).length).toBeGreaterThanOrEqual(1);
  });
});
