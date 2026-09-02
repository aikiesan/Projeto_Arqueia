import type { AuthenticatedPrincipal, Batch, Laboratory, Product, Project } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockBatch1: Batch = {
  archivedAt: null,
  batchNumber: 'LOTE-2026-CITRATO',
  benchOptionId: null,
  createdAt: now,
  currentBalance: 500,
  expirationDate: '2027-12-31T00:00:00.000Z',
  id: 'b1-uuid',
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

const mockBatch2: Batch = {
  archivedAt: null,
  batchNumber: 'LOTE-2026-EDTA',
  benchOptionId: null,
  createdAt: now,
  currentBalance: 250,
  expirationDate: '2028-06-30T00:00:00.000Z',
  id: 'b2-uuid',
  initialQuantity: 500,
  laboratoryId: laboratory.id,
  manufacturer: 'Merck',
  notes: null,
  productId: mockProduct.id,
  qrCode: 'ARQ-LOT-EDTA-02',
  receivedDate: '2026-02-01T00:00:00.000Z',
  spaceOptionId: null,
  status: 'AVAILABLE',
  updatedAt: now,
};

const mockProject = {
  archivedAt: null,
  code: 'PRJ-BIO-01',
  coordinatorUserId: principal.user.id,
  createdAt: now,
  description: 'Projeto de Biotecnologia',
  endDate: null,
  fundingAgency: 'FAPESP',
  id: 'proj-1',
  institutionId: laboratory.institutionId,
  laboratoryId: laboratory.id,
  name: 'Projeto Biocatalisadores',
  startDate: '2026-01-01T00:00:00.000Z',
  status: 'ACTIVE',
  title: 'Estudo de Biocatalisadores',
  updatedAt: now,
} as unknown as Project;

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('Inventory Page Client — Deep-Link & Batch Navigation Challenge Suite', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupFetchMocks = (extraMovements: unknown[] = []) => {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/inventory/products?')) {
        return json({ items: [mockProduct], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url.startsWith('/api/inventory/batches?')) {
        return json({ items: [mockBatch1, mockBatch2], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/projects') return json([mockProject]);
      if (url.startsWith('/api/catalog/options?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url.startsWith('/api/inventory/movements?')) {
        return json({ items: extraMovements, pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/inventory/withdrawals' && init?.method === 'POST') {
        return json({ id: 'mov-1', success: true });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
  };

  it('auto-selects batch and opens withdrawal modal when navigating with ?batch=<qrCode>&action=withdraw', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'withdraw',
      batch: 'ARQ-CP2B-PRD-CITRATO-FE-01',
      laboratory: laboratory.id,
    });

    setupFetchMocks();

    render(<InventoryPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'Retirada Rápida de Insumo' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/LOTE-2026-CITRATO/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Saldo Disponível: 500/)).toBeInTheDocument();
  });

  it('auto-selects batch when navigating with alias ?batchId=<id>', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'withdraw',
      batchId: 'b2-uuid',
      laboratory: laboratory.id,
    });

    setupFetchMocks();

    render(<InventoryPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'Retirada Rápida de Insumo' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/LOTE-2026-EDTA/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Saldo Disponível: 250/)).toBeInTheDocument();
  });

  it('auto-opens Ledger modal when navigating with ?batch=<id>&action=ledger', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'ledger',
      batch: 'b1-uuid',
      laboratory: laboratory.id,
    });

    const mockMovement = {
      balanceAfter: 1000,
      batchId: 'b1-uuid',
      createdAt: now,
      id: 'mov-1',
      laboratoryId: laboratory.id,
      notes: 'Entrada Inicial de Estoque',
      performedAt: now,
      productId: mockProduct.id,
      projectId: null,
      purpose: 'Entrada Inicial',
      quantity: 1000,
      type: 'ENTRY',
      userId: principal.user.id,
    };

    setupFetchMocks([mockMovement]);

    render(<InventoryPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'Livro-Razão — Lote LOTE-2026-CITRATO' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/ARQ-CP2B-PRD-CITRATO-FE-01/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Entrada Inicial')).toBeInTheDocument();
  });

  it('handles non-existent batch gracefully without opening modal or crashing', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'withdraw',
      batch: 'non-existent-batch-uuid-999',
      laboratory: laboratory.id,
    });

    setupFetchMocks();

    render(<InventoryPageClient />);

    // Wait for page to finish loading
    expect(
      await screen.findByRole('heading', { name: 'Estoque & Livro-Razão de Insumos' }, { timeout: 3000 }),
    ).toBeInTheDocument();

    // Withdrawal modal should NOT be open
    expect(screen.queryByRole('heading', { name: 'Retirada Rápida de Insumo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Extrato do Livro-Razão' })).not.toBeInTheDocument();

    // Inventory list is displayed
    expect(screen.getAllByText(/LOTE-2026-CITRATO/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/LOTE-2026-EDTA/).length).toBeGreaterThanOrEqual(1);
  });

  it('completes the withdrawal workflow when submitting the auto-opened withdrawal modal', async () => {
    mockSearchParams = new URLSearchParams({
      action: 'withdraw',
      batch: 'b1-uuid',
      laboratory: laboratory.id,
    });

    const fetchSpy = setupFetchMocks();

    render(<InventoryPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'Retirada Rápida de Insumo' }, { timeout: 3000 }),
    ).toBeInTheDocument();

    // Fill withdrawal form
    const projectSelect = screen.getByDisplayValue('Selecione o projeto aprovado');
    fireEvent.change(projectSelect, { target: { value: 'proj-1' } });

    const qtyInput = screen.getByRole('spinbutton');
    fireEvent.change(qtyInput, { target: { value: '25' } });

    const purposeInput = screen.getByPlaceholderText(/Ex: Preparo da fase móvel/i);
    fireEvent.change(purposeInput, { target: { value: 'Preparo de tampão para HPLC' } });

    // Submit withdrawal
    const submitBtn = screen.getByRole('button', { name: 'Confirmar Retirada' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Check that POST /api/inventory/withdrawals was invoked with correct parameters
      const postCall = fetchSpy.mock.calls.find(
        (c) => c[0] === '/api/inventory/withdrawals' && c[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1]!.body as string);
      expect(body.batchId).toBe('b1-uuid');
      expect(body.projectId).toBe('proj-1');
      expect(body.quantity).toBe(25);
      expect(body.purpose).toBe('Preparo de tampão para HPLC');
    });
  });
});
