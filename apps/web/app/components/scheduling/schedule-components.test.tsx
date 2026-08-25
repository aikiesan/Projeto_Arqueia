import type {
  Equipment,
  ScheduleCapabilities,
  ScheduleItem,
} from '@arqueia/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ScheduleDayView,
  ScheduleDetailsDrawer,
  ScheduleEquipmentTabs,
  ScheduleEventCard,
  ScheduleHeader,
  ScheduleLegend,
  ScheduleStateFeedback,
  ScheduleWeekView,
  calculateEventBlockGeometry,
  formatDurationMinutes,
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
    canCheckIn: false,
    canComplete: false,
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
    canCheckIn: false,
    canComplete: false,
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
    canCheckIn: false,
    canComplete: false,
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
    canCheckIn: false,
    canComplete: false,
  };

  const sampleEquipment1: Equipment = {
    id: '22222222-2222-4222-a222-222222222222',
    laboratoryId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    catalogOptionId: '9a666a62-9dc0-41d1-b245-5ffdce74fad2',
    spaceOptionId: null,
    benchOptionId: null,
    responsibleUserId: null,
    code: 'MS-01',
    name: 'Espectrômetro de Massa',
    assetTag: null,
    serialNumber: null,
    status: 'AVAILABLE',
    reservationPolicy: {
      maxReservationMinutes: 360,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    },
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  };

  const sampleEquipment2: Equipment = {
    id: '33333333-3333-4333-a333-333333333333',
    laboratoryId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    catalogOptionId: '9a666a62-9dc0-41d1-b245-5ffdce74fad2',
    spaceOptionId: null,
    benchOptionId: null,
    responsibleUserId: null,
    code: 'HPLC-01',
    name: 'Cromatógrafo HPLC',
    assetTag: null,
    serialNumber: null,
    status: 'MAINTENANCE',
    reservationPolicy: {
      maxReservationMinutes: 240,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    },
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  };

  const sampleSimultaneousHPLC: ScheduleItem = {
    id: '99999999-9999-4999-a999-999999999999',
    type: 'RESERVATION',
    equipmentId: '33333333-3333-4333-a333-333333333333',
    equipmentName: 'Cromatógrafo HPLC',
    startsAt: '2026-08-14T13:00:00.000Z', // 10:00 em America/Sao_Paulo (simultaneous with sampleReservationMine)
    endsAt: '2026-08-14T17:00:00.000Z',   // 14:00 em America/Sao_Paulo (4 hours continuous)
    title: 'Separação de Peptídeos',
    status: 'CONFIRMED',
    isMine: false,
    canCancel: false,
    canCheckIn: false,
    canComplete: false,
    reservationDetails: {
      reservationId: '99999999-9999-4999-a999-999999999999',
      userId: '44444444-4444-4444-a444-444444444444',
      userName: 'Dr. Carlos Mendes',
      projectId: '55555555-5555-4555-a555-555555555555',
      projectCode: 'BIO-2027',
      purpose: 'Purificação preparativa',
      sampleCount: 6,
      notes: null,
      status: 'CONFIRMED',
    },
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
    it('renders time in the laboratory timezone and uses a native interactive button', () => {
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
      expect(card.tagName).toBe('BUTTON');
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledWith(sampleReservationMine);
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

    it('traps focus and restores it to the opener when closed', () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <>
          <button type="button">Abrir detalhes</button>
          <ScheduleDetailsDrawer
            isOpen={false}
            item={sampleReservationMine}
            onClose={onClose}
            timezone={timezone}
          />
        </>,
      );
      const opener = screen.getByRole('button', { name: 'Abrir detalhes' });
      opener.focus();

      rerender(
        <>
          <button type="button">Abrir detalhes</button>
          <ScheduleDetailsDrawer
            isOpen={true}
            item={sampleReservationMine}
            onClose={onClose}
            timezone={timezone}
          />
        </>,
      );

      const closeIcon = screen.getByRole('button', { name: 'Fechar detalhes' });
      const closeFooter = screen.getByRole('button', { name: 'Fechar' });
      expect(closeIcon).toHaveFocus();

      closeFooter.focus();
      fireEvent.keyDown(window, { key: 'Tab' });
      expect(closeIcon).toHaveFocus();

      closeIcon.focus();
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
      expect(closeFooter).toHaveFocus();

      rerender(
        <>
          <button type="button">Abrir detalhes</button>
          <ScheduleDetailsDrawer
            isOpen={false}
            item={sampleReservationMine}
            onClose={onClose}
            timezone={timezone}
          />
        </>,
      );
      expect(opener).toHaveFocus();
    });
  });

  describe('ScheduleDayView', () => {
    it('renders hourly slots for the day with events placed in appropriate hours', () => {
      const onItemClick = vi.fn();
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          capabilities={{ canReserve: true, canManageBlocks: false }}
          currentDate={baseDate}
          endHour={18}
          items={[sampleReservationMine, sampleReservationOther]}
          onItemClick={onItemClick}
          onSlotClick={onSlotClick}
          startHour={8}
          timezone={timezone}
        />,
      );

      // Event at 10:00 (13:00 UTC) - spans 10:00 and 11:00 slots
      expect(screen.getAllByText('Análise de Proteínas')[0]).toBeInTheDocument();
      // Event at 14:00 (17:00 UTC) - spans 14:00 and 15:00 slots
      expect(screen.getAllByText('Equipamento Reservado')[0]).toBeInTheDocument();

      // Click on event
      fireEvent.click(screen.getAllByText('Análise de Proteínas')[0]!);
      expect(onItemClick).toHaveBeenCalledWith(sampleReservationMine);

      // Click on available slot (e.g. 08:00)
      const slot8 = screen.getByLabelText('Horário disponível às 08:00');
      fireEvent.click(slot8);
      expect(onSlotClick).toHaveBeenCalledWith({
        date: '2026-08-14',
        hour: 8,
        timezone,
      });
    });

    it('supports keyboard on empty time slots', () => {
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          capabilities={{ canReserve: true, canManageBlocks: false }}
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
      expect(onSlotClick).toHaveBeenCalledWith({
        date: '2026-08-14',
        hour: 9,
        timezone,
      });
    });

    it('fails closed when scheduling capabilities are absent', () => {
      render(
        <ScheduleDayView
          currentDate={baseDate}
          items={[]}
          onSlotClick={vi.fn()}
          startHour={9}
          endHour={9}
          timezone={timezone}
        />,
      );

      expect(screen.queryByRole('button', { name: /Horário disponível/ })).not.toBeInTheDocument();
      expect(screen.getByText('Disponível')).toBeInTheDocument();
    });

    it('counts only items belonging to the selected laboratory day', () => {
      render(
        <ScheduleDayView
          currentDate={baseDate}
          items={[
            sampleReservationMine,
            { ...sampleReservationOther, startsAt: '2026-08-15T17:00:00.000Z' },
          ]}
          timezone={timezone}
        />,
      );

      expect(screen.getByText('1 compromisso no dia')).toBeInTheDocument();
    });
  });

  describe('ScheduleWeekView', () => {
    const weekItems = [sampleReservationMine, sampleReservationOther, sampleTechnicalBlock];

    it('renders 7 week days with mobile selector and desktop grid', () => {
      const onItemClick = vi.fn();
      const onSlotClick = vi.fn();

      render(
        <ScheduleWeekView
          capabilities={{ canReserve: true, canManageBlocks: false }}
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
          capabilities={{ canReserve: true, canManageBlocks: false }}
          currentDate={baseDate}
          items={[]} // Empty week
          onSlotClick={onSlotClick}
          timezone={timezone}
        />,
      );

      const bookBtn = screen.getByRole('button', { name: '+ Reservar horário neste dia' });
      fireEvent.click(bookBtn);
      expect(onSlotClick).toHaveBeenCalledWith({
        date: '2026-08-14',
        hour: 9,
        timezone,
      });
    });

    it('derives the week from the laboratory calendar date at a UTC boundary', () => {
      render(
        <ScheduleWeekView
          currentDate={new Date('2026-08-17T01:00:00.000Z')}
          items={[]}
          timezone={timezone}
        />,
      );

      expect(screen.getByRole('tab', { name: /dom, 16 de ago/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /seg, 17 de ago/i })).not.toBeInTheDocument();
    });

    it('supports arrow-key navigation between mobile day tabs', () => {
      render(
        <ScheduleWeekView currentDate={baseDate} items={[]} timezone={timezone} />,
      );

      const selected = screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(selected).toBeDefined();
      if (!selected) return;

      selected.focus();
      fireEvent.keyDown(selected, { key: 'ArrowRight' });
      expect(document.activeElement).toHaveAttribute('role', 'tab');
      expect(document.activeElement).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).not.toBe(selected);
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

  describe('calculateEventBlockGeometry', () => {
    it('computes exact top and height for standard same-day reservations', () => {
      const geom = calculateEventBlockGeometry(
        sampleReservationMine, // 10:00 - 12:00 in America/Sao_Paulo (2h)
        '2026-08-14',
        7, // startHour
        20, // endHour
        64, // hourHeight
        timezone,
      );

      expect(geom.isVisible).toBe(true);
      // From 7:00 to 10:00 is 3 hours => 3 * 64 = 192px
      expect(geom.top).toBe(192);
      // Duration is 2 hours => 2 * 64 - 3 = 125px
      expect(geom.height).toBe(125);
      expect(geom.startTimeLabel).toBe('10:00');
      expect(geom.endTimeLabel).toBe('12:00');
      expect(geom.formattedDuration).toBe('2h');
    });

    it('computes multi-hour continuous span correctly', () => {
      const geom = calculateEventBlockGeometry(
        sampleSimultaneousHPLC, // 10:00 - 14:00 (4h)
        '2026-08-14',
        7,
        20,
        64,
        timezone,
      );

      expect(geom.isVisible).toBe(true);
      expect(geom.top).toBe(192);
      // 4 hours => 4 * 64 - 3 = 253px
      expect(geom.height).toBe(253);
      expect(geom.startTimeLabel).toBe('10:00');
      expect(geom.endTimeLabel).toBe('14:00');
      expect(geom.formattedDuration).toBe('4h');
    });

    it('returns isVisible false for reservations on different days', () => {
      const geom = calculateEventBlockGeometry(
        sampleReservationMine,
        '2026-08-15', // different day
        7,
        20,
        64,
        timezone,
      );

      expect(geom.isVisible).toBe(false);
      expect(geom.top).toBe(0);
      expect(geom.height).toBe(0);
    });

    it('formats duration with minutes correctly', () => {
      expect(formatDurationMinutes(30)).toBe('30min');
      expect(formatDurationMinutes(60)).toBe('1h');
      expect(formatDurationMinutes(90)).toBe('1h 30min');
      expect(formatDurationMinutes(150)).toBe('2h 30min');
    });
  });

  describe('ScheduleEquipmentTabs', () => {
    it('renders tablist role and tabs for All and individual equipments', () => {
      const onSelect = vi.fn();
      render(
        <ScheduleEquipmentTabs
          currentDate={baseDate}
          equipments={[sampleEquipment1, sampleEquipment2]}
          items={[sampleReservationMine, sampleSimultaneousHPLC]}
          onSelectEquipment={onSelect}
          selectedEquipmentId=""
          timezone={timezone}
        />,
      );

      const tablist = screen.getByRole('tablist', { name: 'Filtrar agenda por equipamento' });
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3); // "Todos", "Espectrômetro de Massa", "Cromatógrafo HPLC"

      // "Todos os Equipamentos" is selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Todos os Equipamentos');
      expect(tabs[0]).toHaveTextContent('2'); // 2 equipments total

      // Equipment 1: Espectrômetro de Massa (MS-01) - 1 active reservation today
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveTextContent('Espectrômetro de Massa');
      expect(tabs[1]).toHaveTextContent('MS-01');

      // Equipment 2: Cromatógrafo HPLC (HPLC-01) - 1 active reservation today
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveTextContent('Cromatógrafo HPLC');
      expect(tabs[2]).toHaveTextContent('HPLC-01');
    });

    it('triggers onSelectEquipment on tab click', () => {
      const onSelect = vi.fn();
      render(
        <ScheduleEquipmentTabs
          currentDate={baseDate}
          equipments={[sampleEquipment1, sampleEquipment2]}
          items={[]}
          onSelectEquipment={onSelect}
          selectedEquipmentId=""
          timezone={timezone}
        />,
      );

      const hplcTab = screen.getByRole('tab', { name: /Cromatógrafo HPLC/i });
      fireEvent.click(hplcTab);
      expect(onSelect).toHaveBeenCalledWith(sampleEquipment2.id);
    });

    it('supports keyboard Arrow navigation between equipment tabs', () => {
      const onSelect = vi.fn();
      render(
        <ScheduleEquipmentTabs
          currentDate={baseDate}
          equipments={[sampleEquipment1, sampleEquipment2]}
          items={[]}
          onSelectEquipment={onSelect}
          selectedEquipmentId=""
          timezone={timezone}
        />,
      );

      const allTab = screen.getByRole('tab', { name: /Todos os Equipamentos/i });
      allTab.focus();
      fireEvent.keyDown(allTab, { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenCalledWith(sampleEquipment1.id);

      fireEvent.keyDown(allTab, { key: 'End' });
      expect(onSelect).toHaveBeenCalledWith(sampleEquipment2.id);

      fireEvent.keyDown(allTab, { key: 'Home' });
      expect(onSelect).toHaveBeenCalledWith('');
    });
  });

  describe('ScheduleDayView Resource Lanes Mode', () => {
    it('renders side-by-side columns for each equipment when selectedEquipmentId is empty', () => {
      const onItemClick = vi.fn();
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          capabilities={{ canReserve: true, canManageBlocks: false }}
          currentDate={baseDate}
          endHour={18}
          equipments={[sampleEquipment1, sampleEquipment2]}
          items={[sampleReservationMine, sampleSimultaneousHPLC]}
          onItemClick={onItemClick}
          onSlotClick={onSlotClick}
          selectedEquipmentId=""
          startHour={8}
          timezone={timezone}
        />,
      );

      // Verify header contains both equipment names as lane columns
      expect(screen.getAllByText('Espectrômetro de Massa').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cromatógrafo HPLC').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('MS-01')).toBeInTheDocument();
      expect(screen.getByText('HPLC-01')).toBeInTheDocument();

      // Simultaneous bookings at 10:00 on different machines render without collision
      expect(screen.getByText('Análise de Proteínas')).toBeInTheDocument();
      expect(screen.getByText('Separação de Peptídeos')).toBeInTheDocument();

      // Click on event
      fireEvent.click(screen.getByText('Separação de Peptídeos'));
      expect(onItemClick).toHaveBeenCalledWith(sampleSimultaneousHPLC);

      // Click on an available slot in Cromatógrafo HPLC column at 08:00
      const hplcSlot8 = screen.getByLabelText('Horário disponível para Cromatógrafo HPLC às 08:00');
      fireEvent.click(hplcSlot8);
      expect(onSlotClick).toHaveBeenCalledWith({
        date: '2026-08-14',
        hour: 8,
        timezone,
        equipmentId: sampleEquipment2.id,
      });
    });

    it('supports keyboard Enter on empty lane slot', () => {
      const onSlotClick = vi.fn();

      render(
        <ScheduleDayView
          capabilities={{ canReserve: true, canManageBlocks: false }}
          currentDate={baseDate}
          endHour={12}
          equipments={[sampleEquipment1]}
          items={[]}
          onSlotClick={onSlotClick}
          selectedEquipmentId=""
          startHour={9}
          timezone={timezone}
        />,
      );

      const slot9 = screen.getByLabelText('Horário disponível para Espectrômetro de Massa às 09:00');
      fireEvent.keyDown(slot9, { key: 'Enter' });
      expect(onSlotClick).toHaveBeenCalledWith({
        date: '2026-08-14',
        hour: 9,
        timezone,
        equipmentId: sampleEquipment1.id,
      });
    });
  });
});
