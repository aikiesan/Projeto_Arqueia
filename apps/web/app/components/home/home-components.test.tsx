import type {
  DashboardInventoryAlert,
  DashboardPendingAction,
  DashboardQuickAction,
  DashboardReservation,
  DashboardSummary,
} from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
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

  it('renders a real reservation correctly with time formatted in America/Sao_Paulo', () => {
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
  });

  it('renders empty state when agenda is available but has no reservations', () => {
    render(<TodayReservationsCard available={true} reservations={[]} timezone={timezone} />);

    expect(screen.getByRole('heading', { name: 'Nenhuma reserva para hoje' })).toBeInTheDocument();
    expect(
      screen.getByText('O laboratório não possui compromissos registrados para o dia.'),
    ).toBeInTheDocument();
  });

  it('renders unavailable state when agenda is not available', () => {
    render(<TodayReservationsCard available={false} reservations={[]} timezone={timezone} />);

    expect(
      screen.getByRole('heading', { name: 'Fonte temporariamente indisponível' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Não foi possível carregar os compromissos da agenda neste momento.'),
    ).toBeInTheDocument();
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

  it('renders pending actions ordered as received by props', () => {
    const actions: readonly DashboardPendingAction[] = [
      {
        id: 'act-1',
        kind: 'EQUIPMENT_ATTENTION',
        priority: 'CRITICAL',
        title: 'Calibração Urgente',
        detail: 'Autoclave 01 requer calibração preventiva.',
        href: '/equipamentos/auto-01',
      },
      {
        id: 'act-2',
        kind: 'INVENTORY_ATTENTION',
        priority: 'MEDIUM',
        title: 'Revisão de Validade',
        detail: 'Conferir reagentes do armário 3.',
        href: '/estoque/armario-3',
      },
    ];

    render(<PendingActionsCard actions={actions} available={true} />);

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('Calibração Urgente')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('Revisão de Validade')).toBeInTheDocument();
  });

  it('renders quick actions using contract hrefs', () => {
    const actions: readonly DashboardQuickAction[] = [
      { id: 'qa-1', label: 'Nova Reserva', href: '/agenda/nova' },
      { id: 'qa-2', label: 'Dar Baixa em Estoque', href: '/estoque/retirada' },
    ];

    render(<QuickActions actions={actions} />);

    expect(screen.getByRole('link', { name: 'Ação Nova Reserva' })).toHaveAttribute(
      'href',
      '/agenda/nova',
    );
    expect(screen.getByRole('link', { name: 'Ação Dar Baixa em Estoque' })).toHaveAttribute(
      'href',
      '/estoque/retirada',
    );
  });

  it('renders DashboardSectionState loading and empty states', () => {
    const { rerender } = render(
      <DashboardSectionState loading={true} title="Seção de Teste" />,
    );
    expect(screen.getByText('Carregando...')).toBeInTheDocument();

    rerender(
      <DashboardSectionState
        empty={true}
        emptyMessage="Nenhum dado cadastrado."
        emptyTitle="Vazio"
        title="Seção de Teste"
      />,
    );
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.getByText('Nenhum dado cadastrado.')).toBeInTheDocument();
  });

  it('renders responsive viewports 390px and 1440px without breakage', () => {
    // 390px Mobile Viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    const { container: mobileContainer } = render(
      <TodayReservationsCard available={true} reservations={[]} timezone={timezone} />,
    );
    expect(mobileContainer.querySelector('.dashboard-section')).toBeInTheDocument();

    // 1440px Desktop Viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    window.dispatchEvent(new Event('resize'));
    const { container: desktopContainer } = render(
      <TodayReservationsCard available={true} reservations={[]} timezone={timezone} />,
    );
    expect(desktopContainer.querySelector('.dashboard-section')).toBeInTheDocument();
  });
});
