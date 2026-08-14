import type { ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

export interface ScheduleEventCardProps {
  readonly item: ScheduleItem;
  readonly timezone: string;
  readonly onClick?: ((item: ScheduleItem) => void) | undefined;
  readonly isCompact?: boolean | undefined;
  readonly className?: string | undefined;
}

export function ScheduleEventCard({
  item,
  timezone,
  onClick,
  isCompact = false,
  className = '',
}: ScheduleEventCardProps) {
  const fullTimeLabel = useMemo(() => {
    try {
      const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
      });
      const start = timeFormatter.format(new Date(item.startsAt));
      const end = timeFormatter.format(new Date(item.endsAt));
      return `${start} – ${end}`;
    } catch {
      return `${item.startsAt} – ${item.endsAt}`;
    }
  }, [item.startsAt, item.endsAt, timezone]);

  const isBlock = item.type === 'TECHNICAL_BLOCK';
  const isMine = item.isMine;
  const isCancelled = item.status === 'CANCELLED';

  const typeClass = isBlock
    ? 'schedule-card--block'
    : isMine
      ? 'schedule-card--mine'
      : 'schedule-card--other';

  const statusClass = isCancelled ? 'schedule-card--cancelled' : '';
  const compactClass = isCompact ? 'schedule-card--compact' : '';

  const ariaLabel = useMemo(() => {
    const typeLabel = isBlock ? 'Bloqueio técnico' : 'Reserva';
    const mineLabel = isMine ? ' (Minha reserva)' : '';
    const cancelledLabel = isCancelled ? ' [Cancelado]' : '';
    return `${typeLabel}${mineLabel}: ${item.title}, Equipamento: ${item.equipmentName}, Horário: ${fullTimeLabel}${cancelledLabel}`;
  }, [isBlock, isMine, isCancelled, item.title, item.equipmentName, fullTimeLabel]);

  const content = (
    <>
      <span className="schedule-card-header">
        <time className="schedule-card-time" dateTime={item.startsAt}>
          {fullTimeLabel}
        </time>

        <span className="schedule-card-badge">
          {isBlock ? 'Bloqueio' : isMine ? 'Minha' : 'Ocupado'}
        </span>
      </span>

      <span className="schedule-card-body">
        <strong className="schedule-card-title">{item.title}</strong>
        {!isCompact && (
          <span className="schedule-card-equipment">{item.equipmentName}</span>
        )}
      </span>

      {isCancelled && (
        <span className="schedule-card-cancelled-tag">Cancelado</span>
      )}
    </>
  );

  const classes = `schedule-card ${typeClass} ${statusClass} ${compactClass} ${className} ${onClick ? 'schedule-card--interactive' : ''}`;

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={classes}
        onClick={() => onClick(item)}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <article aria-label={ariaLabel} className={classes}>
      {content}
    </article>
  );
}
