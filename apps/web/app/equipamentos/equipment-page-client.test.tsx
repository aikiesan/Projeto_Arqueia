import type { AuthenticatedPrincipal, Equipment, Laboratory } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EquipmentPageClient } from './equipment-page-client';

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

const equipment: Equipment = {
  id: '8f555951-9dc0-41d1-b245-5ffdce74fad2',
  laboratoryId: laboratory.id,
  catalogOptionId: '9a666a62-9dc0-41d1-b245-5ffdce74fad2',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'HPLC-01',
  name: 'HPLC principal',
  assetTag: null,
  serialNumber: null,
  status: 'AVAILABLE',
  reservationPolicy: { maxReservationMinutes: 720, requiresTraining: true, requiresApproval: false, absenceReleaseMinutes: 30 },
  notes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};


function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('EquipmentPageClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the real empty state without creating example equipment', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/equipment?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url.startsWith('/api/catalog/options?')) {
        return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<EquipmentPageClient />);

    expect(await screen.findByRole('heading', { name: 'Nenhum equipamento cadastrado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar o primeiro' })).toBeInTheDocument();
    expect(screen.queryByText('HPLC Shimadzu LC-2030')).not.toBeInTheDocument();
  });

  it('persists an inline status change through the BFF', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([laboratory]);
      if (url.startsWith('/api/catalog/options?')) return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
      if (url.startsWith('/api/equipment?')) return json({ items: [equipment], pageInfo: { hasNextPage: false, nextCursor: null } });
      if (url === `/api/equipment/${equipment.id}` && init?.method === 'PATCH') return json({ ...equipment, status: 'MAINTENANCE' });
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<EquipmentPageClient />);
    const status = await screen.findByRole('combobox', { name: `Status de ${equipment.name}` });
    fireEvent.change(status, { target: { value: 'MAINTENANCE' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/equipment/${equipment.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'MAINTENANCE' }) }),
    ));
  });
});
