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

describe('QR Scanner Page Client — Camera Permissions & Stress Challenge Suite', () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
      writable: true,
    });
  });

  it('handles complete lack of navigator.mediaDevices gracefully with unsupported message and enables manual input', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.includes('/api/inventory/batches/by-qr/')) {
        return json({
          batchNumber: 'LOTE-MANUAL-01',
          currentBalance: 80,
          id: 'b-manual-1',
          initialQuantity: 100,
          laboratoryId: laboratory.id,
          qrCode: 'ARQ-LOT-MANUAL-01',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    // Verify unsupported camera text
    expect(screen.getByText('Câmera não suportada neste navegador.')).toBeInTheDocument();
    expect(screen.getByText('Câmera pausada')).toBeInTheDocument();

    // Verify manual input is functional despite camera lack
    const input = screen.getByPlaceholderText(/Ex: ARQ-LOT-01, ARQ-EQP-01 ou código.../);
    fireEvent.change(input, { target: { value: 'ARQ-LOT-MANUAL-01' } });

    const submitBtn = screen.getByRole('button', { name: 'Consultar Código' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Lote Identificado')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Lote LOTE-MANUAL-01' })).toBeInTheDocument();
      expect(screen.getByText('80 / 100')).toBeInTheDocument();
    });
  });

  it('handles camera permission denial (NotAllowedError) by showing warning alert and manual fallback instructions', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    // Verify error banner and viewfinder state
    await waitFor(() => {
      expect(
        screen.getByText(/Acesso à câmera indisponível ou negado pelo usuário\. Utilize a entrada manual abaixo\./),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Permissão da câmera bloqueada\. Use a entrada manual abaixo\./),
      ).toBeInTheDocument();
    });

    // Verify "Ativar Câmera" button exists to retry
    const activateBtn = screen.getByRole('button', { name: /Ativar Câmera/i });
    expect(activateBtn).toBeInTheDocument();
  });

  it('handles camera hardware missing (NotFoundError) gracefully', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(new DOMException('Requested device not found', 'NotFoundError'));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Acesso à câmera indisponível ou negado pelo usuário/),
      ).toBeInTheDocument();
    });
  });

  it('auto-resolves code provided via URL parameter ?code= on mount', async () => {
    mockSearchParams = new URLSearchParams({
      code: 'ARQ-CP2B-PRD-EDTA-SAL-01',
      laboratory: laboratory.id,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.includes('/api/inventory/batches/by-qr/')) {
        return json({
          batchNumber: 'LOTE-EDTA-2026',
          currentBalance: 120,
          id: 'b-edta-1',
          initialQuantity: 200,
          laboratoryId: laboratory.id,
          qrCode: 'ARQ-CP2B-PRD-EDTA-SAL-01',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    // Check that result card was automatically resolved and rendered without user clicking submit
    await waitFor(() => {
      expect(screen.getByText('Lote Identificado')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Lote LOTE-EDTA-2026' })).toBeInTheDocument();
      expect(screen.getByText('120 / 200')).toBeInTheDocument();
    });
  });

  it('allows clearing the resolved result card via the Limpar button', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.includes('/api/inventory/batches/by-qr/')) {
        return json({
          batchNumber: 'LOTE-CLEAR-TEST',
          currentBalance: 10,
          id: 'b-clear-1',
          initialQuantity: 10,
          laboratoryId: laboratory.id,
          qrCode: 'ARQ-LOT-CLEAR',
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Ex: ARQ-LOT-01, ARQ-EQP-01 ou código.../);
    fireEvent.change(input, { target: { value: 'ARQ-LOT-CLEAR' } });

    const submitBtn = screen.getByRole('button', { name: 'Consultar Código' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Lote Identificado')).toBeInTheDocument();
    });

    // Click Limpar
    const clearBtn = screen.getByRole('button', { name: 'Limpar' });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText('Lote Identificado')).not.toBeInTheDocument();
      expect(input).toHaveValue('');
    });
  });
});
