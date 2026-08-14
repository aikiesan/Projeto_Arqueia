import type { ScheduleCapabilities, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo, useState } from 'react';

import { ScheduleEventCard } from './schedule-event-card';

export interface ScheduleWeekViewProps {
  readonly currentDate: Date;
  readonly timezone: string;
  readonly items: readonly ScheduleItem[];
  readonly onItemClick?: ((item: ScheduleItem) => void) | undefined;
  readonly onSlotClick?: ((date: Date, hour: number) => void) | undefined;
  readonly capabilities?: ScheduleCapabilities | undefined;
  readonly startHour?: number | undefined;
  readonly endHour?: number | undefined;
  readonly className?: string | undefined;
}

interface WeekDayData {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
  isSelected: boolean;
  items: ScheduleItem[];
}

function getDayStringInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parsed = parseInt(formatter.format(date), 10);
    return parsed === 24 ? 0 : parsed;
  } catch {
    return date.getHours();
  }
}

export function ScheduleWeekView({
  currentDate,
  timezone,
  items,
  onItemClick,
  onSlotClick,
  capabilities,
  startHour = 7,
  endHour = 20,
  className = '',
}: ScheduleWeekViewProps) {
  // Calculate 7 days of the week starting from Monday
  const todayStr = useMemo(() => getDayStringInTimezone(new Date(), timezone), [timezone]);
  const currentDayStr = useMemo(
    () => getDayStringInTimezone(currentDate, timezone),
    [currentDate, timezone],
  );

  const [selectedMobileDayStr, setSelectedMobileDayStr] = useState<string>(currentDayStr);

  const weekDays: WeekDayData[] = useMemo(() => {
    const currentDayOfWeek = currentDate.getDay(); // 0 Sun, 1 Mon...
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + diffToMonday);

    const dayNameFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      weekday: 'short',
    });
    const dayNumberFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      day: 'numeric',
    });
    const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      month: 'short',
    });

    const days: WeekDayData[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const dStr = getDayStringInTimezone(d, timezone);
      const dayItems = items.filter((item) => {
        const itemDate = new Date(item.startsAt);
        return getDayStringInTimezone(itemDate, timezone) === dStr;
      });

      days.push({
        date: d,
        dateStr: dStr,
        dayName: dayNameFormatter.format(d).replace('.', ''),
        dayNumber: dayNumberFormatter.format(d),
        monthName: monthNameFormatter.format(d).replace('.', ''),
        isToday: dStr === todayStr,
        isSelected: dStr === (selectedMobileDayStr || currentDayStr),
        items: dayItems,
      });
    }

    return days;
  }, [currentDate, items, timezone, todayStr, selectedMobileDayStr, currentDayStr]);

  const hoursList = useMemo(() => {
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
    return hours;
  }, [startHour, endHour]);

  const canCreate = Boolean(onSlotClick && (capabilities?.canReserve ?? true));

  // Active day for mobile single-day focus tab
  const activeMobileDay =
    weekDays.find((d) => d.dateStr === selectedMobileDayStr) ??
    weekDays.find((d) => d.dateStr === currentDayStr) ??
    weekDays[0] ?? {
      date: currentDate,
      dateStr: currentDayStr,
      dayName: 'Hoje',
      dayNumber: String(currentDate.getDate()),
      monthName: '',
      isToday: true,
      isSelected: true,
      items: [],
    };

  return (
    <div className={`schedule-week-view ${className}`}>
      {/* Mobile Day Strip / Tabs (visible on mobile viewports) */}
      <div
        aria-label="Seleção rápida do dia da semana"
        className="schedule-week-mobile-strip"
        role="tablist"
      >
        {weekDays.map((day) => {
          const isSelected = day.dateStr === activeMobileDay.dateStr;
          return (
            <button
              aria-controls={`schedule-week-panel-${day.dateStr}`}
              aria-label={`${day.dayName}, ${day.dayNumber} de ${day.monthName} (${day.items.length} ${day.items.length === 1 ? 'item' : 'itens'})`}
              aria-selected={isSelected}
              className={`schedule-week-mobile-day-btn ${isSelected ? 'schedule-week-mobile-day-btn--selected' : ''} ${day.isToday ? 'schedule-week-mobile-day-btn--today' : ''}`}
              id={`schedule-week-tab-${day.dateStr}`}
              key={day.dateStr}
              onClick={() => setSelectedMobileDayStr(day.dateStr)}
              role="tab"
              type="button"
            >
              <span className="schedule-week-mobile-day-name">{day.dayName}</span>
              <span className="schedule-week-mobile-day-num">{day.dayNumber}</span>
              {day.items.length > 0 && (
                <span
                  aria-label={`${day.items.length} eventos`}
                  className="schedule-week-mobile-day-badge"
                >
                  {day.items.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile Focus Panel (shows selected day events in detail on mobile) */}
      <div
        aria-labelledby={`schedule-week-tab-${activeMobileDay.dateStr}`}
        className="schedule-week-mobile-day-content"
        id={`schedule-week-panel-${activeMobileDay.dateStr}`}
        role="tabpanel"
      >
        <div className="schedule-week-mobile-summary">
          <strong>
            {activeMobileDay.dayName.toUpperCase()}, {activeMobileDay.dayNumber} de{' '}
            {activeMobileDay.monthName}
          </strong>
          <span>
            {activeMobileDay.items.length}{' '}
            {activeMobileDay.items.length === 1 ? 'compromisso' : 'compromissos'}
          </span>
        </div>

        {activeMobileDay.items.length > 0 ? (
          <div className="schedule-week-mobile-items-list">
            {activeMobileDay.items.map((item) => (
              <ScheduleEventCard
                item={item}
                key={item.id}
                onClick={onItemClick}
                timezone={timezone}
              />
            ))}
          </div>
        ) : (
          <div className="schedule-week-mobile-empty-day">
            <p>Nenhum compromisso marcado para este dia.</p>
            {canCreate && onSlotClick && (
              <button
                className="schedule-week-mobile-empty-btn"
                onClick={() => onSlotClick(activeMobileDay.date, 9)}
                type="button"
              >
                + Reservar horário neste dia
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop Weekly Full Grid (7 columns, visible on larger viewports) */}
      <div className="schedule-week-grid-container">
        {/* Header row with 7 days */}
        <div className="schedule-week-grid-header">
          <div className="schedule-week-header-time-col">HORA</div>
          {weekDays.map((day) => (
            <div
              className={`schedule-week-header-col ${day.isToday ? 'schedule-week-header-col--today' : ''}`}
              key={day.dateStr}
            >
              <span className="schedule-week-header-day-name">{day.dayName}</span>
              <span className="schedule-week-header-day-num">
                {day.dayNumber}/{day.monthName}
              </span>
            </div>
          ))}
        </div>

        {/* Time Grid Rows */}
        <div className="schedule-week-grid-body">
          {hoursList.map((hour) => (
            <div className="schedule-week-grid-row" key={hour}>
              <div className="schedule-week-grid-time-cell">
                {String(hour).padStart(2, '0')}:00
              </div>

              {weekDays.map((day) => {
                const cellItems = day.items.filter((item) => {
                  const itemStartDate = new Date(item.startsAt);
                  return getHourInTimezone(itemStartDate, timezone) === hour;
                });

                const slotDate = new Date(day.date);
                slotDate.setHours(hour, 0, 0, 0);

                const hasItems = cellItems.length > 0;

                return (
                  <div
                    aria-label={`${day.dayName} às ${String(hour).padStart(2, '0')}:00${hasItems ? ` (${cellItems.length} ocupações)` : ' (Livre)'}`}
                    className={`schedule-week-grid-cell ${hasItems ? 'schedule-week-grid-cell--occupied' : 'schedule-week-grid-cell--free'} ${canCreate ? 'schedule-week-grid-cell--clickable' : ''}`}
                    key={`${day.dateStr}-${hour}`}
                    onClick={
                      !hasItems && canCreate && onSlotClick
                        ? () => onSlotClick(slotDate, hour)
                        : undefined
                    }
                    onKeyDown={
                      !hasItems && canCreate && onSlotClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSlotClick(slotDate, hour);
                            }
                          }
                        : undefined
                    }
                    role={!hasItems && canCreate ? 'button' : undefined}
                    tabIndex={!hasItems && canCreate ? 0 : undefined}
                  >
                    {cellItems.map((item) => (
                      <ScheduleEventCard
                        isCompact={true}
                        item={item}
                        key={item.id}
                        onClick={onItemClick}
                        timezone={timezone}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
