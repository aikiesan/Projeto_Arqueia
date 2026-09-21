import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QrPageClient } from './qr-page-client';

const replace = vi.fn();
const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace }),
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

/** Corpo devolvido por `GET /api/equipment/by-qr` — validado por `equipmentSchema`. */
const equipmentFixture = {
  archivedAt: null,
  assetTag: null,
  benchOptionId: null,
  catalogOptionId: 'cc333333-3333-4333-a333-333333333333',
  code: 'CP2b-EQP-01',
  createdAt: now,
  id: '8f555951-9dc0-41d1-b245-5ffdce74fad2',
  laboratoryId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  name: 'Cromatógrafo Líquido HPLC',
  notes: null,
  reservationPolicy: {
    absenceReleaseMinutes: 30,
    maxReservationMinutes: 240,
    requiresApproval: false,
    requiresTraining: false,
  },
  responsibleUserId: null,
  serialNumber: null,
  spaceOptionId: null,
  status: 'AVAILABLE',
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
    name: 'Lucas Unicamp',
    email: 'lucas@unicamp.br',
    id: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    academicCategory: 'PESQUISADOR',
    institutionId: laboratory.institutionId,
    mustChangePassword: false,
    status: 'ACTIVE',
    updatedAt: now,
  },
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('QrPageClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    // `vi.restoreAllMocks` não zera mocks criados com `vi.fn()` fora de spy.
    pushMock.mockClear();
    replace.mockClear();
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

  /**
   * Regressão do fluxo relatado: a etiqueta do equipamento tem de levar à
   * agenda sem toque extra. Antes, o scan parava num cartão de prévia — quando
   * chegava a resolver, o que dependia de adivinhar o laboratório certo.
   */
  it('abre a agenda do equipamento sozinho quando não há check-in pendente', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/equipment/by-qr?')) return json(equipmentFixture);
      if (url.startsWith('/api/scheduling?')) {
        return json({
          capabilities: { canManageBlocks: false, canReserve: true },
          endsAt: '2026-09-21T23:00:00.000Z',
          items: [],
          laboratoryId: laboratory.id,
          startsAt: '2026-09-21T00:00:00.000Z',
          timezone: 'America/Sao_Paulo',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Equipamento Cromatógrafo' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        `/agenda?laboratory=${laboratory.id}&equipmentId=${equipmentFixture.id}`,
      );
    });
  });

  it('para no cartão de check-in quando há reserva em andamento', async () => {
    const currentTime = Date.now();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/equipment/by-qr?')) return json(equipmentFixture);
      if (url.startsWith('/api/scheduling?')) {
        return json({
          capabilities: { canManageBlocks: false, canReserve: true },
          endsAt: new Date(currentTime + 4 * 60 * 60_000).toISOString(),
          items: [
            {
              canCancel: true,
              canCheckIn: false,
              canComplete: true,
              endsAt: new Date(currentTime + 60 * 60_000).toISOString(),
              equipmentId: equipmentFixture.id,
              equipmentName: equipmentFixture.name,
              id: 'dd444444-4444-4444-a444-444444444444',
              isMine: true,
              startsAt: new Date(currentTime - 30 * 60_000).toISOString(),
              status: 'IN_PROGRESS',
              title: 'Reserva em andamento',
              type: 'RESERVATION',
            },
          ],
          laboratoryId: laboratory.id,
          startsAt: new Date(currentTime - 60 * 60_000).toISOString(),
          timezone: 'America/Sao_Paulo',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Equipamento Cromatógrafo' }));

    await waitFor(() => {
      expect(screen.getByText('Equipamento Identificado')).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
