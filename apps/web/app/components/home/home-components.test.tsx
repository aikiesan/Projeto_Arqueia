import type {
  DashboardInventoryAlert,
  DashboardPendingAction,
  DashboardQuickAction,
  DashboardReservation,
  DashboardSummary,
} from '@arqueia/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DashboardSectionState,
  EquipmentSummaryCards,
  InventoryAlertsCard,
  PendingActionsCard,
  QuickActions,
  TodayReservationsCard,
} from './index.js';

describe('Home Presentational Components', () => {
  const timezone = 'America/Sao_Paulo';

  it('renders a real reservation correctly with time formatted in America/Sao_Paulo and without fixed header links', () => {
    const reservations: readonly DashboardReservation[] = [
      {
        id: '11111111-1111-4111-a111-111111111111',
        equipmentId: '22222222-2222-4222-a222-222222222222',
        equipmentName: 'Cromatógrafo HPLC',
        startsAt: '2026-08-14T14:30:00.000Z',
        endsAt: '2026-08-14T16:30:00.000Z',
        purpose: 'Análise de pureza',
        status: 'CONFIRMED',
        href: '/agenda?reservationId=11111111-1111-4111-a111-111111111111',
      },
    ];

    render(
      <TodayReservationsCard available={true} reservations={reservations} timezone={timezone} />,
    );

    expect(screen.getByText('Cromatógrafo HPLC')).toBeInTheDocument();
    expect(screen.getByText('Análise de pureza')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute(
      'href',
      '/agenda?reservationId=11111111-1111-4111-a111-111111111111',
    );
    expect(screen.getByText('11:30')).toBeInTheDocument(); // 14:30 UTC = 11:30 em Sao Paulo (UTC-3)
    // Garante que não há link fixo presumido /agenda no cabeçalho da seção
    expect(screen.queryByRole('link', { name: 'Abrir agenda' })).not.toBeInTheDocument();
  });

  it('renders empty state when agenda is available but has no reservations without presumed navigation', () => {
    render(<TodayReservationsCard available={true} reservations={[]} timezone={timezone} />);

    expect(screen.getByRole('heading', { name: 'Nenhuma reserva para hoje' })).toBeInTheDocument();
    expect(
      screen.getByText('O laboratório não possui compromissos registrados para o dia.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders unavailable state when agenda is not available without presumed navigation', () => {
    render(<TodayReservationsCard available={false} reservations={[]} timezone={timezone} />);

    expect(
      screen.getByRole('heading', { name: 'Fonte temporariamente indisponível' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Não foi possível carregar os compromissos da agenda neste momento.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders LOW_STOCK inventory alert with contract href', () => {
    const alerts: readonly DashboardInventoryAlert[] = [
      {
        kind: 'LOW_STOCK',
        productId: '33333333-3333-4333-a333-333333333333',
        productName: 'Etanol PA',
        batchId: null,
        batchNumber: null,
        detail: 'Saldo de 500 ML abaixo do estoque mínimo de 1000 ML.',
        href: '/estoque?productId=33333333-3333-4333-a333-333333333333',
      },
    ];

    render(<InventoryAlertsCard alerts={alerts} available={true} />);

    expect(screen.getByRole('heading', { name: '1 alerta(s) ativo(s)' })).toBeInTheDocument();
    expect(
      screen.getByText('Saldo de 500 ML abaixo do estoque mínimo de 1000 ML.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      '/estoque?productId=33333333-3333-4333-a333-333333333333',
    );
  });

  it('renders EXPIRING inventory alert', () => {
    const alerts: readonly DashboardInventoryAlert[] = [
      {
        kind: 'EXPIRING',
        productId: '33333333-3333-4333-a333-333333333333',
        productName: 'Reagente Folin',
        batchId: '44444444-4444-4444-a444-444444444444',
        batchNumber: 'LOTE-2026-A',
        detail: 'Lote vence em 10 dias.',
        href: '/estoque?batchId=44444444-4444-4444-a444-444444444444',
      },
    ];

    render(<InventoryAlertsCard alerts={alerts} available={true} />);

    expect(screen.getByRole('heading', { name: '1 alerta(s) ativo(s)' })).toBeInTheDocument();
    expect(screen.getByText('Lote vence em 10 dias.')).toBeInTheDocument();
  });

  it('renders EXPIRED inventory alert', () => {
    const alerts: readonly DashboardInventoryAlert[] = [
      {
        kind: 'EXPIRED',
        productId: '33333333-3333-4333-a333-333333333333',
        productName: 'Solução Tampão',
        batchId: '55555555-5555-4555-a555-555555555555',
        batchNumber: 'LOTE-2025-X',
        detail: 'Lote expirado em 01/08/2026.',
        href: '/estoque?batchId=55555555-5555-4555-a555-555555555555',
      },
    ];

    render(<InventoryAlertsCard alerts={alerts} available={true} />);

    expect(screen.getByRole('heading', { name: '1 alerta(s) ativo(s)' })).toBeInTheDocument();
    expect(screen.getByText('Lote expirado em 01/08/2026.')).toBeInTheDocument();
  });

  it('does not render invented links in InventoryAlertsCard during loading, unavailable, or empty states', () => {
    // 1. Loading state
    const { rerender } = render(<InventoryAlertsCard alerts={[]} available={true} loading={true} />);
    expect(screen.getByText('Carregando estoque...')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    // 2. Unavailable state
    rerender(<InventoryAlertsCard alerts={[]} available={false} loading={false} />);
    expect(screen.getByText('Atualização indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    // 3. Empty state
    rerender(<InventoryAlertsCard alerts={[]} available={true} loading={false} />);
    expect(screen.getByText('Estoque sem alertas')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders equipment summary with available and maintenance equipment', () => {
    const summary: DashboardSummary['equipmentSummary'] = {
      total: 10,
      byStatus: {
        AVAILABLE: 7,
        UNDER_EVALUATION: 1,
        UNAVAILABLE: 0,
        MAINTENANCE: 2,
      },
    };

    render(<EquipmentSummaryCards available={true} summary={summary} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 2 manutenção + 1 avaliação + 0 indisponível
  });

  it('preserves the server-provided order of pending actions strictly without client sorting', () => {
    const actions: readonly DashboardPendingAction[] = [
      {
        id: 'act-first',
        kind: 'EQUIPMENT_ATTENTION',
        priority: 'CRITICAL',
        title: 'Calibração Urgente',
        detail: 'Autoclave 01 requer calibração preventiva.',
        href: '/equipamentos/auto-01',
      },
      {
        id: 'act-second',
        kind: 'INVENTORY_ATTENTION',
        priority: 'MEDIUM',
        title: 'Revisão de Validade',
        detail: 'Conferir reagentes do armário 3.',
        href: '/estoque/armario-3',
      },
      {
        id: 'act-third',
        kind: 'RESERVATION_ATTENTION',
        priority: 'HIGH',
        title: 'Aprovação de Horário Especial',
        detail: 'Reserva fora do horário padrão requer validação.',
        href: '/agenda/reserva-99',
      },
    ];

    const { container } = render(<PendingActionsCard actions={actions} available={true} />);

    const renderedItems = container.querySelectorAll('.schedule-item');
    expect(renderedItems).toHaveLength(3);

    // Valida a ordem exata dos elementos no DOM preservando a ordem do array do servidor
    expect(within(renderedItems[0] as HTMLElement).getByText('Calibração Urgente')).toBeInTheDocument();
    expect(within(renderedItems[0] as HTMLElement).getByText('CRITICAL')).toBeInTheDocument();

    expect(within(renderedItems[1] as HTMLElement).getByText('Revisão de Validade')).toBeInTheDocument();
    expect(within(renderedItems[1] as HTMLElement).getByText('MEDIUM')).toBeInTheDocument();

    expect(within(renderedItems[2] as HTMLElement).getByText('Aprovação de Horário Especial')).toBeInTheDocument();
    expect(within(renderedItems[2] as HTMLElement).getByText('HIGH')).toBeInTheDocument();
  });

  it('renders quick actions using contract hrefs and produces no links when actions is empty', () => {
    const actions: readonly DashboardQuickAction[] = [
      { id: 'qa-1', label: 'Nova Reserva', href: '/agenda/nova' },
      { id: 'qa-2', label: 'Dar Baixa em Estoque', href: '/estoque/retirada' },
    ];

    const { rerender } = render(<QuickActions actions={actions} />);

    expect(screen.getByRole('link', { name: 'Ação Nova Reserva' })).toHaveAttribute(
      'href',
      '/agenda/nova',
    );
    expect(screen.getByRole('link', { name: 'Ação Dar Baixa em Estoque' })).toHaveAttribute(
      'href',
      '/estoque/retirada',
    );

    // Quando actions está vazio, nenhum link inventado deve ser renderizado
    rerender(<QuickActions actions={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders DashboardSectionState with aria-busy and suppresses actionHref during loading and unavailable states', () => {
    // 1. Loading: deve ter aria-busy="true" e suprimir actionHref
    const { container, rerender } = render(
      <DashboardSectionState
        actionHref="/agenda"
        actionLabel="Abrir agenda"
        loading={true}
        title="Seção de Teste"
      />,
    );
    expect(container.querySelector('section')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir agenda' })).not.toBeInTheDocument();

    // 2. Unavailable: deve suprimir actionHref
    rerender(
      <DashboardSectionState
        actionHref="/agenda"
        actionLabel="Abrir agenda"
        available={false}
        loading={false}
        title="Seção de Teste"
      />,
    );
    expect(container.querySelector('section')).not.toHaveAttribute('aria-busy');
    expect(screen.getByText('Fonte temporariamente indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir agenda' })).not.toBeInTheDocument();

    // 3. Normal / Disponível: deve renderizar actionHref
    rerender(
      <DashboardSectionState
        actionHref="/agenda"
        actionLabel="Abrir agenda"
        available={true}
        loading={false}
        title="Seção de Teste"
      >
        <p>Conteúdo da seção</p>
      </DashboardSectionState>,
    );
    expect(screen.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute('href', '/agenda');
    expect(screen.getByText('Conteúdo da seção')).toBeInTheDocument();
  });

  it('viewport smoke test: renders presence and structure across 390px and 1440px viewports', () => {
    // 390px Mobile Viewport Smoke Test
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    const { container: mobileContainer } = render(
      <TodayReservationsCard available={true} reservations={[]} timezone={timezone} />,
    );
    const mobileSection = mobileContainer.querySelector('.dashboard-section');
    expect(mobileSection).toBeInTheDocument();
    expect(within(mobileSection as HTMLElement).getByRole('heading', { name: 'Reservas de hoje' })).toBeInTheDocument();
    expect(within(mobileSection as HTMLElement).getByRole('heading', { name: 'Nenhuma reserva para hoje' })).toBeInTheDocument();

    // 1440px Desktop Viewport Smoke Test
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    window.dispatchEvent(new Event('resize'));
    const { container: desktopContainer } = render(
      <TodayReservationsCard available={true} reservations={[]} timezone={timezone} />,
    );
    const desktopSection = desktopContainer.querySelector('.dashboard-section');
    expect(desktopSection).toBeInTheDocument();
    expect(within(desktopSection as HTMLElement).getByRole('heading', { name: 'Reservas de hoje' })).toBeInTheDocument();
    expect(within(desktopSection as HTMLElement).getByRole('heading', { name: 'Nenhuma reserva para hoje' })).toBeInTheDocument();
  });
});
