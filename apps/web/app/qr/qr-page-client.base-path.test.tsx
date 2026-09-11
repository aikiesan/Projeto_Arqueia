import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão de implantação em subcaminho: a página de QR chamava
 * `lookupAndResolveQr` sem o fetcher prefixado e renderizava os destinos crus,
 * então sob `/arqueia` a consulta batia na SPA do CP2b e o botão de ação levava
 * para fora do app.
 */

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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


describe('QrPageClient sob base path /arqueia', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/arqueia');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('consulta a API sob o prefixo e aponta a ação para dentro do app', async () => {
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === '/arqueia/api/session') return json({ principal });
      if (url === '/arqueia/api/laboratories') return json([laboratory]);
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

    const { QrPageClient } = await import('./qr-page-client');
    render(<QrPageClient />);

    expect(await screen.findByRole('heading', { name: 'Leitor de QR Code & Código de Barras' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ex: ARQ-LOT-01, ARQ-EQP-01 ou código.../), {
      target: { value: 'ARQ-CP2B-PRD-CITRATO-FE-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar Código' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Retirar Insumo/i })).toHaveAttribute(
        'href',
        `/arqueia/estoque?laboratory=${laboratory.id}&batch=b-citrato-1&action=withdraw`,
      );
    });

    expect(requestedUrls.some((url) => url.startsWith('/arqueia/api/inventory/batches/by-qr/'))).toBe(true);
    expect(requestedUrls.every((url) => url.startsWith('/arqueia/'))).toBe(true);
  });
});
