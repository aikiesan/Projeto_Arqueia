import type { ScheduleCapabilities } from '@arqueia/contracts';
import React, { useMemo } from 'react';

import {
  addCalendarDays,
  formatCalendarDate,
  getCalendarDateInTimezone,
  getCalendarWeekStart,
} from './calendar-time';
import type { CalendarViewMode } from './types';

export interface ScheduleHeaderProps {
  readonly currentDate: Date;
  readonly viewMode: CalendarViewMode;
  readonly timezone: string;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  readonly onViewModeChange?: ((mode: CalendarViewMode) => void) | undefined;
  readonly capabilities?: ScheduleCapabilities | undefined;
  readonly onNewReservation?: (() => void) | undefined;
  readonly onNewBlock?: (() => void) | undefined;
  readonly isLoading?: boolean | undefined;
  readonly className?: string | undefined;
}

export function ScheduleHeader({
  currentDate,
  viewMode,
  timezone,
  onPrevious,
  onToday,
  onNext,
  onViewModeChange,
  capabilities,
  onNewReservation,
  onNewBlock,
  isLoading = false,
  className = '',
}: ScheduleHeaderProps) {
  const formattedTitle = useMemo(() => {
    const currentCalendarDate = getCalendarDateInTimezone(currentDate, timezone);
    if (viewMode === 'DAY') {
      const formatted = formatCalendarDate(currentCalendarDate, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    const monday = getCalendarWeekStart(currentCalendarDate);
    const sunday = addCalendarDays(monday, 6);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return `${formatCalendarDate(monday, options)} – ${formatCalendarDate(sunday, options)}`;
  }, [currentDate, viewMode, timezone]);

  return (
    <header className={`schedule-header ${className}`}>
      <div className="schedule-header-nav-group">
        <div aria-label="Navegação temporal da agenda" className="schedule-nav-controls" role="group">
          <button
            aria-label="Período anterior"
            className="schedule-nav-btn"
            disabled={isLoading}
            onClick={onPrevious}
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            aria-label="Ir para hoje"
            className="schedule-nav-btn schedule-nav-btn--today"
            disabled={isLoading}
            onClick={onToday}
            type="button"
          >
            Hoje
          </button>
          <button
            aria-label="Próximo período"
            className="schedule-nav-btn"
            disabled={isLoading}
            onClick={onNext}
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <h2 aria-live="polite" className="schedule-header-title">
          {formattedTitle}
        </h2>
      </div>

      <div className="schedule-header-actions-group">
        {onViewModeChange && (
          <div
            aria-label="Modo de visualização do calendário"
            className="schedule-view-mode-selector"
            role="group"
          >
            <button
              aria-pressed={viewMode === 'DAY'}
              className={`schedule-mode-btn ${viewMode === 'DAY' ? 'schedule-mode-btn--active' : ''}`}
              onClick={() => onViewModeChange('DAY')}
              type="button"
            >
              Dia
            </button>
            <button
              aria-pressed={viewMode === 'WEEK'}
              className={`schedule-mode-btn ${viewMode === 'WEEK' ? 'schedule-mode-btn--active' : ''}`}
              onClick={() => onViewModeChange('WEEK')}
              type="button"
            >
              Semana
            </button>
          </div>
        )}

        <div className="schedule-header-action-buttons">
          {capabilities?.canReserve && onNewReservation && (
            <button
              aria-label="Criar nova reserva de equipamento"
              className="schedule-action-btn schedule-action-btn--primary"
              onClick={onNewReservation}
              type="button"
            >
              <span aria-hidden="true">+</span> Nova reserva
            </button>
          )}

          {capabilities?.canManageBlocks && onNewBlock && (
            <button
              aria-label="Criar novo bloqueio técnico"
              className="schedule-action-btn schedule-action-btn--secondary"
              onClick={onNewBlock}
              type="button"
            >
              <span aria-hidden="true">⊘</span> Bloqueio técnico
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
