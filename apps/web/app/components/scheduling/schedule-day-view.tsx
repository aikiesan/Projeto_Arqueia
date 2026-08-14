import type { ScheduleCapabilities, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

import {
  formatCalendarDate,
  getCalendarDateInTimezone,
  getHourInTimezone,
} from './calendar-time';
import type { ScheduleSlotSelection } from './calendar-time';
import { ScheduleEventCard } from './schedule-event-card';

export interface ScheduleDayViewProps {
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

interface HourSlotData {
  hour: number;
  label: string;
  items: ScheduleItem[];
}

export function ScheduleDayView({
  currentDate,
  timezone,
  items,
  onItemClick,
  onSlotClick,
  capabilities,
  startHour = 7,
  endHour = 20,
  className = '',
}: ScheduleDayViewProps) {
  const currentDayStr = useMemo(
    () => getCalendarDateInTimezone(currentDate, timezone),
    [currentDate, timezone],
  );

  const formattedDayHeader = useMemo(() => {
    const formatted = formatCalendarDate(currentDayStr, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [currentDayStr]);

  const dayItems = useMemo(
    () =>
      items.filter(
        (item) =>
          getCalendarDateInTimezone(new Date(item.startsAt), timezone) === currentDayStr,
      ),
    [currentDayStr, items, timezone],
  );

  const slots: HourSlotData[] = useMemo(() => {
    const list: HourSlotData[] = [];
    const totalHours = endHour - startHour + 1;

    for (let i = 0; i < totalHours; i++) {
      const hour = startHour + i;
      const itemsInHour = dayItems.filter((item) => {
        const itemStartDate = new Date(item.startsAt);
        const itemHour = getHourInTimezone(itemStartDate, timezone);
        return itemHour === hour;
      });

      list.push({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        items: itemsInHour,
      });
    }

    return list;
  }, [dayItems, timezone, startHour, endHour]);

  const canCreateInSlot = Boolean(onSlotClick && capabilities?.canReserve === true);

  return (
    <div className={`schedule-day-view ${className}`}>
      <div className="schedule-day-header">
        <h3 className="schedule-day-title">{formattedDayHeader}</h3>
        <span className="schedule-day-subtitle">
          {dayItems.length}{' '}
          {dayItems.length === 1 ? 'compromisso no dia' : 'compromissos no dia'}
        </span>
      </div>

      <div
        aria-label={`Grade horária de ${formattedDayHeader}`}
        className="schedule-day-grid"
        role="region"
      >
        {slots.map((slot) => {
          const hasItems = slot.items.length > 0;

          return (
            <div
              className={`schedule-day-slot-row ${hasItems ? 'schedule-day-slot-row--occupied' : 'schedule-day-slot-row--free'}`}
              key={slot.hour}
            >
              <div className="schedule-day-slot-time">
                <time dateTime={`${currentDayStr}T${String(slot.hour).padStart(2, '0')}:00`}>
                  {slot.label}
                </time>
              </div>

              <div className="schedule-day-slot-content">
                {hasItems ? (
                  <div className="schedule-day-slot-items">
                    {slot.items.map((item) => (
                      <ScheduleEventCard
                        item={item}
                        key={item.id}
                        onClick={onItemClick}
                        timezone={timezone}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    aria-label={`Horário disponível às ${slot.label}`}
                    className={`schedule-day-slot-empty ${canCreateInSlot ? 'schedule-day-slot-empty--clickable' : ''}`}
                    onClick={
                      canCreateInSlot && onSlotClick
                        ? () =>
                            onSlotClick({
                              date: currentDayStr,
                              hour: slot.hour,
                              timezone,
                            })
                        : undefined
                    }
                    onKeyDown={
                      canCreateInSlot && onSlotClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSlotClick({
                                date: currentDayStr,
                                hour: slot.hour,
                                timezone,
                              });
                            }
                          }
                        : undefined
                    }
                    role={canCreateInSlot ? 'button' : undefined}
                    tabIndex={canCreateInSlot ? 0 : undefined}
                  >
                    <span className="schedule-day-slot-empty-label">
                      {canCreateInSlot ? 'Disponível — Toque para reservar' : 'Disponível'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
