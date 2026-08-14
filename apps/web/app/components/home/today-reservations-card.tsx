import type { DashboardReservation } from '@arqueia/contracts';

import { DashboardSectionState } from './dashboard-section-state';

export interface TodayReservationsCardProps {
  readonly reservations: readonly DashboardReservation[];
  readonly available: boolean;
  readonly loading?: boolean;
  readonly timezone: string;
}

export function TodayReservationsCard({
  reservations,
  available,
  loading = false,
  timezone,
}: TodayReservationsCardProps) {
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });

  return (
    <DashboardSectionState
      actionHref="/agenda"
      actionLabel="Abrir agenda"
      available={available}
      empty={reservations.length === 0}
      emptyMessage="O laboratório não possui compromissos registrados para o dia."
      emptyTitle="Nenhuma reserva para hoje"
      iconName="agenda"
      kicker="Agenda"
      loading={loading}
      title="Reservas de hoje"
      unavailableMessage="Não foi possível carregar os compromissos da agenda neste momento."
    >
      <div className="schedule-list">
        {reservations.map((reservation) => (
          <article className="schedule-item" key={reservation.id}>
            <time dateTime={reservation.startsAt}>
              {timeFormatter.format(new Date(reservation.startsAt))}
            </time>
            <div>
              <strong>{reservation.equipmentName}</strong>
              <span>{reservation.purpose}</span>
            </div>
            <a href={reservation.href}>Ver</a>
          </article>
        ))}
      </div>
    </DashboardSectionState>
  );
}
