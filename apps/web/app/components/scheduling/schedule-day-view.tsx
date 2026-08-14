import type { ScheduleCapabilities, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

import { ScheduleEventCard } from './schedule-event-card';

export interface ScheduleDayViewProps {
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

interface HourSlotData {
  hour: number;
  label: string;
  slotDate: Date;
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
    () => getDayStringInTimezone(currentDate, timezone),
    [currentDate, timezone],
  );

  const formattedDayHeader = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const formatted = formatter.format(currentDate);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return currentDate.toLocaleDateString('pt-BR');
    }
  }, [currentDate, timezone]);

  const slots: HourSlotData[] = useMemo(() => {
    const list: HourSlotData[] = [];
    const totalHours = endHour - startHour + 1;

    for (let i = 0; i < totalHours; i++) {
      const hour = startHour + i;
      const slotDate = new Date(currentDate);
      slotDate.setHours(hour, 0, 0, 0);

      const itemsInHour = items.filter((item) => {
        const itemStartDate = new Date(item.startsAt);
        const itemDayStr = getDayStringInTimezone(itemStartDate, timezone);
        const itemHour = getHourInTimezone(itemStartDate, timezone);

        return itemDayStr === currentDayStr && itemHour === hour;
      });

      list.push({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        slotDate,
        items: itemsInHour,
      });
    }

    return list;
  }, [currentDate, items, timezone, currentDayStr, startHour, endHour]);

  const canCreateInSlot = Boolean(onSlotClick && (capabilities?.canReserve ?? true));

  return (
    <div className={`schedule-day-view ${className}`}>
      <div className="schedule-day-header">
        <h3 className="schedule-day-title">{formattedDayHeader}</h3>
        <span className="schedule-day-subtitle">
          {items.length} {items.length === 1 ? 'compromisso no dia' : 'compromissos no dia'}
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
                        ? () => onSlotClick(slot.slotDate, slot.hour)
                        : undefined
                    }
                    onKeyDown={
                      canCreateInSlot && onSlotClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSlotClick(slot.slotDate, slot.hour);
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
