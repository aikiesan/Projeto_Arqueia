import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QrPageClient } from './qr-page-client';

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
    email: 'lucas@unicamp.br',
    id: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    identityProvider: 'LOCAL',
    institutionId: laboratory.institutionId,
    name: 'Lucas Nakamura',
    status: 'ACTIVE',
    supervisorUserId: null,
    updatedAt: now,
  },
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('QrPageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the QR scanner page header, camera section, and manual input form', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();
    expect(screen.getByText(/Aponte a câmera para a etiqueta do recipiente/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrada Manual ou Leitor de Código de Barras' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: ARQ-LOT-01, ARQ-EQP-01 ou código.../)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar Código' })).toBeInTheDocument();
  });

  it('resolves batch QR code on manual submission and displays batch result card', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.includes('/api/inventory/batches/by-qr/')) {
        return json({
          batchNumber: 'LOTE-2026-CITRATO',
          currentBalance: 250,
          id: 'b-citrato-1',
          initialQuantity: 500,
          laboratoryId: laboratory.id,
          qrCode: 'ARQ-CP2B-PRD-CITRATO-FE-01',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ex: ARQ-LOT-01, ARQ-EQP-01 ou código.../);
    fireEvent.change(input, { target: { value: 'ARQ-CP2B-PRD-CITRATO-FE-01' } });

    const submitBtn = screen.getByRole('button', { name: 'Consultar Código' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Lote Identificado')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Lote LOTE-2026-CITRATO' })).toBeInTheDocument();
      expect(screen.getByText('250 / 500')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Retirar Insumo/i })).toHaveAttribute(
        'href',
        `/estoque?laboratory=${laboratory.id}&batch=b-citrato-1&action=withdraw`,
      );
    });
  });

  it('resolves equipment code when clicking a sample chip', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.includes('/api/equipment?')) {
        return json({
          items: [
            {
              code: 'CP2B-EQP-01',
              id: 'eq-hplc-1',
              laboratoryId: laboratory.id,
              model: 'Agilent 1260',
              name: 'Cromatógrafo Líquido HPLC',
              status: 'AVAILABLE',
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    const sampleBtn = screen.getByRole('button', { name: 'Equipamento Cromatógrafo' });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText('Equipamento Identificado')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Cromatógrafo Líquido HPLC' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ver Agenda & Reservar/i })).toHaveAttribute(
        'href',
        `/agenda?laboratory=${laboratory.id}&equipmentId=eq-hplc-1`,
      );
    });
  });
});
