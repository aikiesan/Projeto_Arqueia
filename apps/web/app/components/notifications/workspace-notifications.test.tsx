import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceNotifications } from './workspace-notifications';

const laboratoryId = '11111111-1111-4111-a111-111111111111';

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('WorkspaceNotifications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra à coordenação o contador e o atalho para o compilado', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/field-reports/summary?')) {
        return json({
          laboratoryId,
          openByKind: { EQUIPMENT_PROBLEM: 0, MAINTENANCE_REQUEST: 0, SUPPLY_USAGE: 0, GENERAL_SUPPORT: 2 },
          byStatus: { NEW: 2, IN_REVIEW: 0, RESOLVED: 0 },
          openBlockingUse: 0,
        });
      }
      return json({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
    });
    render(<WorkspaceNotifications scope={{ laboratoryId, canReviewFieldReports: true }} />);

    const bell = await screen.findByRole('button', { name: 'Notificações: 2 novas' });
    fireEvent.click(bell);
    const panel = screen.getByRole('region', { name: 'Informes novos' });
    expect(within(panel).getByRole('link', { name: /Ver todos os informes/ })).toHaveAttribute(
      'href',
      `/informes?laboratory=${laboratoryId}`,
    );
  });

  it('para quem não revisa, fica sem contador e aponta para o Informar', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<WorkspaceNotifications scope={{ laboratoryId, canReviewFieldReports: false }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByText(/Use o botão Informar/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver todos/ })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
