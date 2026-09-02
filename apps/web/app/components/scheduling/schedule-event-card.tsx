import type { ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

export interface ScheduleEventCardProps {
  readonly item: ScheduleItem;
  readonly timezone: string;
  readonly onClick?: ((item: ScheduleItem) => void) | undefined;
  readonly isCompact?: boolean | undefined;
  readonly isContinuation?: boolean | undefined;
  readonly isContinuous?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly className?: string | undefined;
}

export function ScheduleEventCard({
  item,
  timezone,
  onClick,
  isCompact = false,
  isContinuation = false,
  isContinuous = false,
  style,
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
      return isContinuation ? `↳ até ${end}` : `${start} – ${end}`;
    } catch {
      return `${item.startsAt} – ${item.endsAt}`;
    }
  }, [item.startsAt, item.endsAt, timezone, isContinuation]);

  const isBlock = item.type === 'TECHNICAL_BLOCK';
  const isMine = item.isMine;
  const isCancelled = item.status === 'CANCELLED' || item.status === 'RELEASED_ABSENCE';
  const isInProgress = item.status === 'IN_PROGRESS';

  const typeClass = isBlock
    ? 'schedule-card--block'
    : isInProgress
      ? 'schedule-card--in-progress'
      : isMine
        ? 'schedule-card--mine'
        : 'schedule-card--other';

  const statusClass = isCancelled ? 'schedule-card--cancelled' : '';
  const compactClass = isCompact ? 'schedule-card--compact' : '';
  const continuationClass = isContinuation ? 'schedule-card--continuation' : '';
  const continuousClass = isContinuous ? 'schedule-card--continuous' : '';

  const ariaLabel = useMemo(() => {
    const typeLabel = isBlock ? 'Bloqueio técnico' : 'Reserva';
    const mineLabel = isMine ? ' (Minha reserva)' : '';
    const progressLabel = isInProgress ? ' [Em andamento]' : '';
    const cancelledLabel = isCancelled ? ' [Cancelado]' : '';
    const contLabel = isContinuation ? ' (Continuação)' : '';
    return `${typeLabel}${mineLabel}${progressLabel}${contLabel}: ${item.title}, Equipamento: ${item.equipmentName}, Horário: ${fullTimeLabel}${cancelledLabel}`;
  }, [isBlock, isMine, isInProgress, isCancelled, isContinuation, item.title, item.equipmentName, fullTimeLabel]);

  const content = (
    <>
      <span className="schedule-card-header">
        <time className="schedule-card-time" dateTime={item.startsAt}>
          {fullTimeLabel}
        </time>

        <span className="schedule-card-badge">
          {isBlock
            ? 'Bloqueio'
            : isInProgress
              ? 'Em uso'
              : isContinuation
                ? 'Em uso'
                : isMine
                  ? 'Minha'
                  : 'Ocupado'}
        </span>
      </span>

      <span className="schedule-card-body">
        <strong className="schedule-card-title">{item.title}</strong>
        {!isCompact && !isContinuation && (
          <span className="schedule-card-equipment">{item.equipmentName}</span>
        )}
        {!isCompact && item.reservationDetails?.projectCode && (
          <span className="schedule-card-project">{item.reservationDetails.projectCode}</span>
        )}
      </span>

      {isCancelled && (
        <span className="schedule-card-cancelled-tag">
          {item.status === 'RELEASED_ABSENCE' ? 'Ausência' : 'Cancelado'}
        </span>
      )}
    </>
  );

  const classes = `schedule-card ${typeClass} ${statusClass} ${compactClass} ${continuationClass} ${continuousClass} ${className} ${onClick ? 'schedule-card--interactive' : ''}`;

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={classes}
        onClick={() => onClick(item)}
        style={style}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <article aria-label={ariaLabel} className={classes} style={style}>
      {content}
    </article>
  );
}
