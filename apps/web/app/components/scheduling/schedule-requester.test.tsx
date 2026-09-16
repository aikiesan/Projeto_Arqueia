import type { ScheduleItem } from '@arqueia/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScheduleDetailsDrawer, ScheduleEventCard } from './index';

/**
 * Quem reservou o equipamento tem de aparecer sem precisar abrir a reserva:
 * é o dado que o laboratório usa para resolver disputa de horário no balcão.
 */
describe('Nome de quem reservou na agenda', () => {
  const timezone = 'America/Sao_Paulo';

  const reservation: ScheduleItem = {
    id: '11111111-1111-4111-a111-111111111111',
    type: 'RESERVATION',
    equipmentId: '22222222-2222-4222-a222-222222222222',
    equipmentName: 'Espectrômetro de Massa',
    startsAt: '2026-08-14T13:00:00.000Z',
    endsAt: '2026-08-14T15:00:00.000Z',
    title: 'Equipamento Reservado',
    reservedBy: 'Marina Duarte',
    status: 'CONFIRMED',
    isMine: false,
    canCancel: false,
    canCheckIn: false,
    canComplete: false,
  };

  const technicalBlock: ScheduleItem = {
    ...reservation,
    id: '66666666-6666-4666-a666-666666666666',
    type: 'TECHNICAL_BLOCK',
    title: 'Bloqueio técnico',
    reservedBy: null,
    status: 'ACTIVE',
  };

  it('mostra o nome no cartão da grade', () => {
    render(<ScheduleEventCard item={reservation} timezone={timezone} />);

    expect(screen.getByText('Marina Duarte')).toBeInTheDocument();
  });

  it('inclui o nome na descrição acessível do cartão', () => {
    render(<ScheduleEventCard item={reservation} timezone={timezone} />);

    expect(screen.getByLabelText(/Reservado por: Marina Duarte/)).toBeInTheDocument();
  });

  it('não inventa reservante em bloqueio técnico', () => {
    render(<ScheduleEventCard item={technicalBlock} timezone={timezone} />);

    expect(screen.queryByText('Marina Duarte')).not.toBeInTheDocument();
  });

  it('mostra "Reservado por" nos detalhes da reserva', () => {
    render(
      <ScheduleDetailsDrawer
        isOpen
        item={reservation}
        onClose={() => undefined}
        timezone={timezone}
      />,
    );

    expect(screen.getByText('Reservado por')).toBeInTheDocument();
    expect(screen.getByText('Marina Duarte')).toBeInTheDocument();
  });

  it('não pede reservante nos detalhes de um bloqueio técnico', () => {
    render(
      <ScheduleDetailsDrawer
        isOpen
        item={technicalBlock}
        onClose={() => undefined}
        timezone={timezone}
      />,
    );

    expect(screen.queryByText('Reservado por')).not.toBeInTheDocument();
  });
});
