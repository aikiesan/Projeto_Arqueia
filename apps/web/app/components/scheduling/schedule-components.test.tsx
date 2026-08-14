import type {
  ScheduleCapabilities,
  ScheduleItem,
} from '@arqueia/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ScheduleDayView,
  ScheduleDetailsDrawer,
  ScheduleEventCard,
  ScheduleHeader,
  ScheduleLegend,
  ScheduleStateFeedback,
  ScheduleWeekView,
} from './index';

describe('Scheduling Presentational Components', () => {
  const timezone = 'America/Sao_Paulo';
  const baseDate = new Date('2026-08-14T12:00:00.000Z'); // 2026-08-14 is a Friday

  const sampleReservationMine: ScheduleItem = {
    id: '11111111-1111-4111-a111-111111111111',
    type: 'RESERVATION',
    equipmentId: '22222222-2222-4222-a222-222222222222',
    equipmentName: 'Espectrômetro de Massa',
    startsAt: '2026-08-14T13:00:00.000Z', // 10:00 em America/Sao_Paulo (UTC-3)
    endsAt: '2026-08-14T15:00:00.000Z',   // 12:00 em America/Sao_Paulo (UTC-3)
    title: 'Análise de Proteínas',
    status: 'CONFIRMED',
    isMine: true,
    canCancel: true,
    reservationDetails: {
      reservationId: '11111111-1111-4111-a111-111111111111',
      userId: '33333333-3333-4333-a333-333333333333',
      userName: 'Dra. Maria Silva',
      projectId: '44444444-4444-4444-a444-444444444444',
      projectCode: 'BIO-2026',
      purpose: 'Identificação de peptídeos',
      sampleCount: 12,
      notes: 'Trazer solvente grau HPLC.',
      status: 'CONFIRMED',
    },
  };

  const sampleReservationOther: ScheduleItem = {
    id: '55555555-5555-4555-a555-555555555555',
    type: 'RESERVATION',
    equipmentId: '22222222-2222-4222-a222-222222222222',
    equipmentName: 'Espectrômetro de Massa',
    startsAt: '2026-08-14T17:00:00.000Z', // 14:00 em America/Sao_Paulo
    endsAt: '2026-08-14T19:00:00.000Z',   // 16:00 em America/Sao_Paulo
    title: 'Equipamento Reservado',
    status: 'CONFIRMED',
    isMine: false,
    canCancel: false,
  };

  const sampleTechnicalBlock: ScheduleItem = {
    id: '66666666-6666-4666-a666-666666666666',
    type: 'TECHNICAL_BLOCK',
    equipmentId: '22222222-2222-4222-a222-222222222222',
    equipmentName: 'Espectrômetro de Massa',
    startsAt: '2026-08-14T19:00:00.000Z', // 16:00 em America/Sao_Paulo
    endsAt: '2026-08-14T21:00:00.000Z',   // 18:00 em America/Sao_Paulo
    title: 'Manutenção Preventiva Semestral',
    status: 'ACTIVE',
    isMine: false,
    canCancel: true,
    blockDetails: {
      technicalBlockId: '66666666-6666-4666-a666-666666666666',
      reason: 'MAINTENANCE',
      description: 'Troca de filamentos da fonte de ionização.',
      createdByUserId: '77777777-7777-4777-a777-777777777777',
      status: 'ACTIVE',
    },
  };

  const sampleCancelledReservation: ScheduleItem = {
    id: '88888888-8888-4888-a888-888888888888',
    type: 'RESERVATION',
    equipmentId: '22222222-2222-4222-a222-222222222222',
    equipmentName: 'Espectrômetro de Massa',
    startsAt: '2026-08-14T21:00:00.000Z', // 18:00 em America/Sao_Paulo
    endsAt: '2026-08-14T22:00:00.000Z',   // 19:00 em America/Sao_Paulo
    title: 'Sessão Cancelada',
    status: 'CANCELLED',
    isMine: true,
    canCancel: false,
  };

  describe('ScheduleLegend', () => {
    it('renders standard legend items with correct labels and accessibility region', () => {
      render(<ScheduleLegend />);

      expect(
        screen.getByRole('region', { name: 'Legenda de ocupações da agenda' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Minha reserva')).toBeInTheDocument();
      expect(screen.getByText('Outras reservas')).toBeInTheDocument();
      expect(screen.getByText('Bloqueio técnico')).toBeInTheDocument();
      expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
    });

    it('renders cancelled item when showCancelled is true', () => {
      render(<ScheduleLegend showCancelled={true} />);

      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });
  });

  describe('ScheduleHeader', () => {
    it('formats date according to timezone in DAY mode and triggers navigation', () => {
      const onPrevious = vi.fn();
      const onToday = vi.fn();
      const onNext = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <ScheduleHeader
          currentDate={baseDate}
          onNext={onNext}
          onPrevious={onPrevious}
          onToday={onToday}
          onViewModeChange={onViewModeChange}
          timezone={timezone}
          viewMode="DAY"
        />,
      );

      // Title must reflect 14 de agosto de 2026 in pt-BR
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('14 de agosto de 2026');

      // Navigation buttons
      fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }));
      expect(onPrevious).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Ir para hoje' }));
      expect(onToday).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
      expect(onNext).toHaveBeenCalledTimes(1);

      // Mode switch
      fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
      expect(onViewModeChange).toHaveBeenCalledWith('WEEK');
    });

    it('formats week range in WEEK mode', () => {
      render(
        <ScheduleHeader
          currentDate={baseDate}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          timezone={timezone}
          viewMode="WEEK"
        />,
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toContain('2026');
      expect(heading.textContent).toContain('10');
      expect(heading.textContent).toContain('16');
    });

    it('renders action buttons strictly when capabilities allow', () => {
      const onNewReservation = vi.fn();
      const onNewBlock = vi.fn();

      const capabilitiesAll: ScheduleCapabilities = {
        canReserve: true,
        canManageBlocks: true,
      };

      const { rerender } = render(
        <ScheduleHeader
          capabilities={capabilitiesAll}
          currentDate={baseDate}
          onNewBlock={onNewBlock}
          onNewReservation={onNewReservation}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          timezone={timezone}
          viewMode="DAY"
        />,
      );

      expect(screen.getByRole('button', { name: /Criar nova reserva/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Criar novo bloqueio/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Criar nova reserva/i }));
      expect(onNewReservation).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Criar novo bloqueio/i }));
      expect(onNewBlock).toHaveBeenCalledTimes(1);

      // Rerender with canReserve = true, canManageBlocks = false
      rerender(
        <ScheduleHeader
          capabilities={{ canReserve: true, canManageBlocks: false }}
          currentDate={baseDate}
          onNewBlock={onNewBlock}
          onNewReservation={onNewReservation}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          timezone={timezone}
          viewMode="DAY"
        />,
      );

      expect(screen.getByRole('button', { name: /Criar nova reserva/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Criar novo bloqueio/i })).not.toBeInTheDocument();

      // Rerender with no capabilities
      rerender(
        <ScheduleHeader
          capabilities={{ canReserve: false, canManageBlocks: false }}
          currentDate={baseDate}
          onNewBlock={onNewBlock}
          onNewReservation={onNewReservation}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onToday={vi.fn()}
          timezone={timezone}
          viewMode="DAY"
        />,
      );

      expect(screen.queryByRole('button', { name: /Criar nova reserva/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Criar novo bloqueio/i })).not.toBeInTheDocument();
    });
  });

  describe('ScheduleEventCard', () => {
    it('renders time formatted in America/Sao_Paulo, title, equipment and handles click/keyboard', () => {
      const onClick = vi.fn();

      render(
        <ScheduleEventCard
          item={sampleReservationMine}
          onClick={onClick}
          timezone={timezone}
        />,
      );

      // 13:00 UTC = 10:00 em America/Sao_Paulo (UTC-3)
      expect(screen.getByText('10:00 – 12:00')).toBeInTheDocument();
      expect(screen.getByText('Análise de Proteínas')).toBeInTheDocument();
      expect(screen.getByText('Espectrômetro de Massa')).toBeInTheDocument();
      expect(screen.getByText('Minha')).toBeInTheDocument();

      // Click
      const card = screen.getByRole('button');
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledWith(sampleReservationMine);

      // Keyboard (Enter / Space)
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(3);
    });

    it('renders technical block with appropriate badge and formatting', () => {
      render(
        <ScheduleEventCard
          item={sampleTechnicalBlock}
          timezone={timezone}
        />,
      );

      // 19:00 UTC = 16:00 em America/Sao_Paulo
      expect(screen.getByText('16:00 – 18:00')).toBeInTheDocument();
      expect(screen.getByText('Manutenção Preventiva Semestral')).toBeInTheDocument();
      expect(screen.getByText('Bloqueio')).toBeInTheDocument();
    });

    it('renders cancelled reservation with cancelled indicator', () => {
      render(
        <ScheduleEventCard
          item={sampleCancelledReservation}
          timezone={timezone}
        />,
      );

      expect(screen.getByText('Cancelado')).toBeInTheDocument();
      expect(screen.getByText('Sessão Cancelada')).toBeInTheDocument();
    });
  });

  describe('ScheduleStateFeedback', () => {
    it('renders loading state with aria-busy and status role', () => {
      render(<ScheduleStateFeedback state="loading" />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Carregando agenda...')).toBeInTheDocument();
    });

    it('renders empty state', () => {
      render(
        <ScheduleStateFeedback
          message="Nenhum registro para a semana."
          state="empty"
          title="Sem agendamentos"
        />,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Sem agendamentos')).toBeInTheDocument();
      expect(screen.getByText('Nenhum registro para a semana.')).toBeInTheDocument();
    });

    it('renders unavailable state with retry button', () => {
      const onRetry = vi.fn();
      render(
        <ScheduleStateFeedback
          onRetry={onRetry}
          state="unavailable"
        />,
      );

      expect(screen.getByText('Agenda temporariamente indisponível')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: 'Tentar novamente' });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders error state with role alert', () => {
      const onRetry = vi.fn();
      render(
        <ScheduleStateFeedback
          message="Falha de conexão com a API."
          onRetry={onRetry}
          state="error"
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Erro ao carregar a agenda')).toBeInTheDocument();
      expect(screen.getByText('Falha de conexão com a API.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('ScheduleDetailsDrawer', () => {
    it('does not render when isOpen is false or item is null', () => {
      const { rerender } = render(
        <ScheduleDetailsDrawer
          isOpen={false}
          item={sampleReservationMine}
          onClose={vi.fn()}
          timezone={timezone}
        />,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(
        <ScheduleDetailsDrawer
          isOpen={true}
          item={null}
          onClose={vi.fn()}
          timezone={timezone}
        />,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders reservation details and cancel button when canCancel is true', () => {
      const onClose = vi.fn();
      const onCancelItem = vi.fn();

      render(
        <ScheduleDetailsDrawer
          isOpen={true}
          item={sampleReservationMine}
          onCancelItem={onCancelItem}
          onClose={onClose}
          timezone={timezone}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      expect(screen.getByText('Análise de Proteínas')).toBeInTheDocument();
      expect(screen.getByText('Identificação de peptídeos')).toBeInTheDocument();
      expect(screen.getByText('Dra. Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('BIO-2026')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Trazer solvente grau HPLC.')).toBeInTheDocument();

      // Cancel button is shown because canCancel = true
      const cancelBtn = screen.getByRole('button', { name: 'Cancelar reserva' });
      expect(cancelBtn).toBeInTheDocument();

      fireEvent.click(cancelBtn);
      expect(onCancelItem).toHaveBeenCalledWith(sampleReservationMine);

      // Close button
      fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT render cancel button when item.canCancel is false', () => {
      render(
        <ScheduleDetailsDrawer
          isOpen={true}
          item={sampleReservationOther}
          onCancelItem={vi.fn()}
          onClose={vi.fn()}
          timezone={timezone}
        />,
      );

      expect(screen.queryByRole('button', { name: /Cancelar/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    });

    it('renders technical block details with reason and description', () => {
      const onCancelItem = vi.fn();

      render(
        <ScheduleDetailsDrawer
          isOpen={true}
          item={sampleTechnicalBlock}
          onCancelItem={onCancelItem}
          onClose={vi.fn()}
          timezone={timezone}
        />,
      );

      expect(screen.getByText('Manutenção Preventiva Semestral')).toBeInTheDocument();
      expect(screen.getByText('Manutenção Preventiva / Corretiva')).toBeInTheDocument();
      expect(screen.getByText('Troca de filamentos da fonte de ionização.')).toBeInTheDocument();

      // Technical block has canCancel = true
      expect(screen.getByRole('button', { name: 'Cancelar bloqueio' })).toBeInTheDocument();
    });

    it('closes on Escape key press', () => {
      const onClose = vi.fn();

      render(
        <ScheduleDetailsDrawer
          isOpen={true}
          item={sampleReservationMine}
          onClose={onClose}
          timezone={timezone}
        />,
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ScheduleDayView', () => {
    it('renders hourly slots for the day with events placed in appropriate hours', () => {
      const onItemClick = vi.fn();
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          currentDate={baseDate}
          endHour={18}
          items={[sampleReservationMine, sampleReservationOther]}
          onItemClick={onItemClick}
          onSlotClick={onSlotClick}
          startHour={8}
          timezone={timezone}
        />,
      );

      // Event at 10:00 (13:00 UTC)
      expect(screen.getByText('Análise de Proteínas')).toBeInTheDocument();
      // Event at 14:00 (17:00 UTC)
      expect(screen.getByText('Equipamento Reservado')).toBeInTheDocument();

      // Click on event
      fireEvent.click(screen.getByText('Análise de Proteínas'));
      expect(onItemClick).toHaveBeenCalledWith(sampleReservationMine);

      // Click on available slot (e.g. 08:00)
      const slot8 = screen.getByLabelText('Horário disponível às 08:00');
      fireEvent.click(slot8);
      expect(onSlotClick).toHaveBeenCalledWith(expect.any(Date), 8);
    });

    it('supports keyboard on empty time slots', () => {
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          currentDate={baseDate}
          endHour={12}
          items={[]}
          onSlotClick={onSlotClick}
          startHour={9}
          timezone={timezone}
        />,
      );

      const slot9 = screen.getByLabelText('Horário disponível às 09:00');
      fireEvent.keyDown(slot9, { key: 'Enter' });
      expect(onSlotClick).toHaveBeenCalledWith(expect.any(Date), 9);
    });
  });

  describe('ScheduleWeekView', () => {
    const weekItems = [sampleReservationMine, sampleReservationOther, sampleTechnicalBlock];

    it('renders 7 week days with mobile selector and desktop grid', () => {
      const onItemClick = vi.fn();
      const onSlotClick = vi.fn();

      render(
        <ScheduleWeekView
          currentDate={baseDate}
          items={weekItems}
          onItemClick={onItemClick}
          onSlotClick={onSlotClick}
          timezone={timezone}
        />,
      );

      // Mobile day tabs
      const tablist = screen.getByRole('tablist', { name: 'Seleção rápida do dia da semana' });
      expect(tablist).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(7);

      // Friday (14) has 3 items in weekItems
      const fridayTab = tabs.find((t) => t.textContent?.includes('14'));
      expect(fridayTab).toBeDefined();

      // Selecting a day tab
      if (fridayTab) {
        fireEvent.click(fridayTab);
        expect(fridayTab).toHaveAttribute('aria-selected', 'true');
      }

      // Event cards displayed in mobile list
      expect(screen.getAllByText('Análise de Proteínas').length).toBeGreaterThanOrEqual(1);
    });

    it('allows booking from empty day action in mobile view', () => {
      const onSlotClick = vi.fn();

      render(
        <ScheduleWeekView
          currentDate={baseDate}
          items={[]} // Empty week
          onSlotClick={onSlotClick}
          timezone={timezone}
        />,
      );

      const bookBtn = screen.getByRole('button', { name: '+ Reservar horário neste dia' });
      fireEvent.click(bookBtn);
      expect(onSlotClick).toHaveBeenCalledWith(expect.any(Date), 9);
    });
  });

  describe('Responsive and Accessibility checks (390px mobile & 1440px desktop)', () => {
    it('handles mobile viewport layout structures (390px)', () => {
      // Simulate mobile window width
      window.innerWidth = 390;
      window.dispatchEvent(new Event('resize'));

      const { container } = render(
        <div>
          <ScheduleHeader
            capabilities={{ canReserve: true, canManageBlocks: false }}
            currentDate={baseDate}
            onNext={vi.fn()}
            onPrevious={vi.fn()}
            onToday={vi.fn()}
            timezone={timezone}
            viewMode="WEEK"
          />
          <ScheduleLegend showCancelled={true} />
          <ScheduleWeekView
            currentDate={baseDate}
            items={[sampleReservationMine]}
            timezone={timezone}
          />
        </div>,
      );

      // Mobile day strip must exist
      expect(container.querySelector('.schedule-week-mobile-strip')).toBeInTheDocument();
      expect(container.querySelector('.schedule-week-mobile-day-content')).toBeInTheDocument();

      // Legend must have accessible region
      expect(screen.getByRole('region', { name: 'Legenda de ocupações da agenda' })).toBeInTheDocument();
    });

    it('handles desktop viewport layout structures (1440px)', () => {
      // Simulate desktop window width
      window.innerWidth = 1440;
      window.dispatchEvent(new Event('resize'));

      const { container } = render(
        <div>
          <ScheduleHeader
            capabilities={{ canReserve: true, canManageBlocks: true }}
            currentDate={baseDate}
            onNext={vi.fn()}
            onPrevious={vi.fn()}
            onToday={vi.fn()}
            timezone={timezone}
            viewMode="WEEK"
          />
          <ScheduleWeekView
            currentDate={baseDate}
            items={[sampleReservationMine]}
            timezone={timezone}
          />
        </div>,
      );

      // Desktop grid container must exist
      expect(container.querySelector('.schedule-week-grid-container')).toBeInTheDocument();
      expect(container.querySelector('.schedule-week-grid-header')).toBeInTheDocument();
    });
  });
});
