import type { ScheduleCapabilities, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo, useState } from 'react';

import {
  addCalendarDays,
  formatCalendarDate,
  getCalendarDateInTimezone,
  getCalendarWeekStart,
  getHourInTimezone,
} from './calendar-time';
import type { ScheduleSlotSelection } from './calendar-time';
import { ScheduleEventCard } from './schedule-event-card';

export interface ScheduleWeekViewProps {
  readonly currentDate: Date;
  readonly timezone: string;
  readonly items: readonly ScheduleItem[];
  readonly onItemClick?: ((item: ScheduleItem) => void) | undefined;
  readonly onSlotClick?: ((selection: ScheduleSlotSelection) => void) | undefined;
  readonly capabilities?: ScheduleCapabilities | undefined;
  readonly startHour?: number | undefined;
  readonly endHour?: number | undefined;
  readonly className?: string | undefined;
}

interface WeekDayData {
  dateStr: string;
  dayName: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
  items: ScheduleItem[];
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
  const todayStr = useMemo(
    () => getCalendarDateInTimezone(new Date(), timezone),
    [timezone],
  );
  const currentDayStr = useMemo(
    () => getCalendarDateInTimezone(currentDate, timezone),
    [currentDate, timezone],
  );

  const [selectedMobileDayStr, setSelectedMobileDayStr] = useState<string>(currentDayStr);

  const weekDays: WeekDayData[] = useMemo(() => {
    const monday = getCalendarWeekStart(currentDayStr);

    const days: WeekDayData[] = [];
    for (let i = 0; i < 7; i++) {
      const dStr = addCalendarDays(monday, i);
      const dayItems = items.filter((item) => {
        const itemDate = new Date(item.startsAt);
        return getCalendarDateInTimezone(itemDate, timezone) === dStr;
      });

      days.push({
        dateStr: dStr,
        dayName: formatCalendarDate(dStr, { weekday: 'short' }).replace('.', ''),
        dayNumber: formatCalendarDate(dStr, { day: 'numeric' }),
        monthName: formatCalendarDate(dStr, { month: 'short' }).replace('.', ''),
        isToday: dStr === todayStr,
        items: dayItems,
      });
    }

    return days;
  }, [currentDayStr, items, timezone, todayStr]);

  const hoursList = useMemo(() => {
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
    return hours;
  }, [startHour, endHour]);

  const canCreate = Boolean(onSlotClick && capabilities?.canReserve === true);

  const selectedDayStr = weekDays.some((day) => day.dateStr === selectedMobileDayStr)
    ? selectedMobileDayStr
    : currentDayStr;

  // Active day for mobile single-day focus tab
  const activeMobileDay =
    weekDays.find((d) => d.dateStr === selectedDayStr) ??
    weekDays.find((d) => d.dateStr === currentDayStr) ??
    weekDays[0] ?? {
      dateStr: currentDayStr,
      dayName: 'Hoje',
      dayNumber: formatCalendarDate(currentDayStr, { day: 'numeric' }),
      monthName: '',
      isToday: true,
      items: [],
    };

  const selectMobileDay = (index: number) => {
    const nextDay = weekDays[index];
    if (!nextDay) return;
    setSelectedMobileDayStr(nextDay.dateStr);
    document.getElementById(`schedule-week-tab-${nextDay.dateStr}`)?.focus();
  };

  return (
    <div className={`schedule-week-view ${className}`}>
      {/* Mobile Day Strip / Tabs (visible on mobile viewports) */}
      <div
        aria-label="Seleção rápida do dia da semana"
        className="schedule-week-mobile-strip"
        role="tablist"
      >
        {weekDays.map((day, index) => {
          const isSelected = day.dateStr === activeMobileDay.dateStr;
          return (
            <button
              aria-controls="schedule-week-panel"
              aria-label={`${day.dayName}, ${day.dayNumber} de ${day.monthName} (${day.items.length} ${day.items.length === 1 ? 'item' : 'itens'})`}
              aria-selected={isSelected}
              className={`schedule-week-mobile-day-btn ${isSelected ? 'schedule-week-mobile-day-btn--selected' : ''} ${day.isToday ? 'schedule-week-mobile-day-btn--today' : ''}`}
              id={`schedule-week-tab-${day.dateStr}`}
              key={day.dateStr}
              onClick={() => setSelectedMobileDayStr(day.dateStr)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  selectMobileDay((index + 1) % weekDays.length);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  selectMobileDay((index - 1 + weekDays.length) % weekDays.length);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  selectMobileDay(0);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  selectMobileDay(weekDays.length - 1);
                }
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
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
        id="schedule-week-panel"
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
                onClick={() =>
                  onSlotClick({
                    date: activeMobileDay.dateStr,
                    hour: 9,
                    timezone,
                  })
                }
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

                const hasItems = cellItems.length > 0;

                return (
                  <div
                    aria-label={`${day.dayName} às ${String(hour).padStart(2, '0')}:00${hasItems ? ` (${cellItems.length} ocupações)` : ' (Livre)'}`}
                    className={`schedule-week-grid-cell ${hasItems ? 'schedule-week-grid-cell--occupied' : 'schedule-week-grid-cell--free'} ${!hasItems && canCreate ? 'schedule-week-grid-cell--clickable' : ''}`}
                    key={`${day.dateStr}-${hour}`}
                    onClick={
                      !hasItems && canCreate && onSlotClick
                        ? () =>
                            onSlotClick({
                              date: day.dateStr,
                              hour,
                              timezone,
                            })
                        : undefined
                    }
                    onKeyDown={
                      !hasItems && canCreate && onSlotClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSlotClick({
                                date: day.dateStr,
                                hour,
                                timezone,
                              });
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
