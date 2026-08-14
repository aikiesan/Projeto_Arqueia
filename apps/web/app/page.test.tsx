import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomeDashboard } from './home-dashboard';
import { createDashboardSummary } from './dashboard';
import { createWorkspacePresentation } from './presentation';

const metadata = { createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', archivedAt: null } as const;
const principal: AuthenticatedPrincipal = {
  user: { ...metadata, id: '00000000-0000-4000-8000-000000000001', institutionId: '00000000-0000-4000-8000-000000000002', name: 'Lucas Nakamura', email: 'lucas@example.com', supervisorUserId: null, status: 'ACTIVE', identityProvider: 'LOCAL' },
  memberships: [],
  systemRoles: [{ ...metadata, id: '00000000-0000-4000-8000-000000000003', userId: '00000000-0000-4000-8000-000000000001', role: 'ADMIN' }],
};
const laboratories: readonly Laboratory[] = [{ ...metadata, id: '00000000-0000-4000-8000-000000000004', institutionId: '00000000-0000-4000-8000-000000000002', name: 'Laboratório CP2b', code: 'CP2b', timezone: 'America/Sao_Paulo' }];

describe('home workspace', () => {
  it('deriva o shell do usuário autenticado e de seus laboratórios', () => {
    const presentation = createWorkspacePresentation(principal, laboratories);
    expect(presentation.currentUser.name).toBe('Lucas Nakamura');
    expect(presentation.currentContext).toBe('Laboratório CP2b');
    expect(presentation.mobileNavigation.map(({ label }) => label)).toEqual(['Início', 'Agenda', 'Estoque', 'Mais']);
  });

  it('renderiza a home e oferece encerramento da sessão', () => {
    const summary = createDashboardSummary(laboratories[0]!.id, []);
    render(<HomeDashboard equipmentDataAvailable presentation={createWorkspacePresentation(principal, laboratories)} summary={summary} />);
    expect(screen.getByRole('heading', { name: 'Olá, Lucas.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reservas de hoje' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agenda temporariamente indisponível' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('renderiza smoke test em viewport mobile (390px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    const summary = createDashboardSummary(laboratories[0]!.id, []);
    const { container } = render(<HomeDashboard equipmentDataAvailable presentation={createWorkspacePresentation(principal, laboratories)} summary={summary} />);
    expect(screen.getByRole('heading', { name: 'Olá, Lucas.' })).toBeInTheDocument();
    expect(container.querySelector('.arqueia-workspace')).toBeInTheDocument();
  });

  it('renderiza smoke test em viewport desktop (1440px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    window.dispatchEvent(new Event('resize'));
    const summary = createDashboardSummary(laboratories[0]!.id, []);
    const { container } = render(<HomeDashboard equipmentDataAvailable presentation={createWorkspacePresentation(principal, laboratories)} summary={summary} />);
    expect(screen.getByRole('heading', { name: 'Olá, Lucas.' })).toBeInTheDocument();
    expect(container.querySelector('.arqueia-workspace')).toBeInTheDocument();
  });
});
