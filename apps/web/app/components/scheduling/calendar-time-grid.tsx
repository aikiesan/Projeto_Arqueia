'use client';

import type { Equipment, ScheduleItem } from '@arqueia/contracts';
import { useMemo } from 'react';

interface CalendarTimeGridProps {
  readonly viewMode: 'DAY' | 'WEEK' | 'MONTH';
  readonly currentDate: Date;
  readonly scheduleItems: readonly ScheduleItem[];
  readonly selectedEquipment?: Equipment | null;
  readonly onItemClick: (item: ScheduleItem) => void;
  readonly onSlotClick: (date: Date, hour: number) => void;
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diffToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function getMonthDays(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = firstDay.getDay(); // 0=Sun
  const diffToMonday = 1 - (startDay === 0 ? 7 : startDay);

  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() + diffToMonday);

  return Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function CalendarTimeGrid({
  viewMode,
  currentDate,
  scheduleItems,
  selectedEquipment,
  onItemClick,
  onSlotClick,
}: CalendarTimeGridProps) {
  const days = useMemo(() => {
    if (viewMode === 'DAY') {
      const d = new Date(currentDate);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
    if (viewMode === 'WEEK') {
      return getWeekDays(currentDate);
    }
    return getMonthDays(currentDate);
  }, [viewMode, currentDate]);

  if (viewMode === 'MONTH') {
    return (
      <div className="month-grid-container" style={{ marginTop: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, padding: '0.5rem 0' }}>
          {WEEKDAY_NAMES.map((name) => (
            <div key={name}>{name}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, auto)' }}>
          {days.map((day) => {
            const itemsForDay = scheduleItems.filter((item) => isSameDay(new Date(item.startsAt), day));
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();

            return (
              <div
                key={day.toISOString()}
                onClick={() => onSlotClick(day, 9)}
                style={{
                  borderRight: '1px solid #edf2f7',
                  borderBottom: '1px solid #edf2f7',
                  padding: '0.4rem',
                  background: isCurrentMonth ? '#fff' : '#f7fafc',
                  opacity: isCurrentMonth ? 1 : 0.6,
                  cursor: 'pointer',
                  minHeight: '100px',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: isSameDay(day, new Date()) ? 'var(--brand-primary, #0052cc)' : '#4a5568' }}>
                  {day.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {itemsForDay.slice(0, 3).map((item) => {
                    const isBlock = item.type === 'TECHNICAL_BLOCK';
                    const isMine = item.isMine;
                    const bg = isBlock ? '#fed7d7' : isMine ? '#bee3f8' : '#e2e8f0';

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          background: bg,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {item.title}
                      </div>
                    );
                  })}
                  {itemsForDay.length > 3 && (
                    <div style={{ fontSize: '0.7rem', color: '#718096', fontWeight: 600 }}>
                      +{itemsForDay.length - 3} mais
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

  // DAY or WEEK Hour-Grid
  return (
    <div className="time-grid-wrapper" style={{ marginTop: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      {selectedEquipment && (
        <div style={{ background: '#ebf8ff', borderBottom: '1px solid #bee3f8', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ color: '#2b6cb0' }}>{selectedEquipment.name} ({selectedEquipment.code})</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#2c5282' }}>
            <span>Duração máx: <strong>{selectedEquipment.reservationPolicy.maxReservationMinutes / 60}h</strong></span>
            <span>Treinamento: <strong>{selectedEquipment.reservationPolicy.requiresTraining ? 'Obrigatório' : 'Não exigido'}</strong></span>
            <span>Aprovação: <strong>{selectedEquipment.reservationPolicy.requiresApproval ? 'Sim' : 'Não'}</strong></span>
          </div>
        </div>
      )}

      {/* Header Row Days */}
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, background: '#f7fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#a0aec0', borderRight: '1px solid #e2e8f0' }}>
          HORA
        </div>
        {days.map((day) => (
          <div key={day.toISOString()} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#718096', fontWeight: 600 }}>
              {WEEKDAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: isSameDay(day, new Date()) ? 'var(--brand-primary, #0052cc)' : '#2d3748' }}>
              {day.getDate()} / {day.getMonth() + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Grid Time Rows */}
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, position: 'relative' }}>
        {HOURS.map((hour) => (
          <div key={hour} style={{ display: 'contents' }}>
            <div style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#718096', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #edf2f7', textAlign: 'center', background: '#faf5ff' }}>
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const cellDate = new Date(day);
              cellDate.setHours(hour, 0, 0, 0);

              const itemsForCell = scheduleItems.filter((item) => {
                const itemStart = new Date(item.startsAt);
                return isSameDay(itemStart, day) && itemStart.getHours() === hour;
              });

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onClick={() => onSlotClick(day, hour)}
                  style={{
                    borderRight: '1px solid #edf2f7',
                    borderBottom: '1px solid #edf2f7',
                    padding: '0.2rem',
                    minHeight: '52px',
                    position: 'relative',
                    cursor: 'pointer',
                    background: '#fff',
                  }}
                >
                  {itemsForCell.map((item) => {
                    const isBlock = item.type === 'TECHNICAL_BLOCK';
                    const isMine = item.isMine;

                    const bg = isBlock ? '#feb2b2' : isMine ? '#90cdf4' : '#e2e8f0';
                    const border = isBlock ? '#e53e3e' : isMine ? '#3182ce' : '#a0aec0';

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                        style={{
                          background: bg,
                          borderLeft: `4px solid ${border}`,
                          borderRadius: '4px',
                          padding: '0.25rem 0.4rem',
                          marginBottom: '0.2rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#1a202c',
                        }}
                      >
                        <div>{new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {item.title}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
