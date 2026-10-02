import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PublicAgendaClient } from './public-agenda-client';

const laboratory = { id: '11111111-1111-4111-a111-111111111111', code: 'CP2b', name: 'Laboratório CP2b' };

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('PublicAgendaClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('oferece Informar no cabeçalho, já no laboratório exibido', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/public/laboratories') return json([laboratory]);
      return json({
        laboratory,
        timezone: 'America/Sao_Paulo',
        startsAt: '2026-09-28T03:00:00.000Z',
        endsAt: '2026-10-05T03:00:00.000Z',
        items: [],
      });
    });

    render(<PublicAgendaClient />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Informar' })).toHaveAttribute(
        'href',
        `/informar?laboratory=${laboratory.id}`,
      ),
    );
    expect(screen.getByRole('link', { name: 'Entrar para reservar' })).toHaveAttribute('href', '/login');
  });
});
