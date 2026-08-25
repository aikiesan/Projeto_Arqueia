import type { Equipment, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

import { getCalendarDateInTimezone } from './calendar-time';

export interface ScheduleEquipmentTabsProps {
  readonly equipments: readonly Equipment[];
  readonly selectedEquipmentId: string;
  readonly onSelectEquipment: (equipmentId: string) => void;
  readonly items?: readonly ScheduleItem[] | undefined;
  readonly currentDate?: Date | undefined;
  readonly timezone?: string | undefined;
  readonly className?: string | undefined;
}

export function ScheduleEquipmentTabs({
  equipments,
  selectedEquipmentId,
  onSelectEquipment,
  items = [],
  currentDate,
  timezone,
  className = '',
}: ScheduleEquipmentTabsProps) {
  const currentDayStr = useMemo(() => {
    if (!currentDate || !timezone) return null;
    return getCalendarDateInTimezone(currentDate, timezone);
  }, [currentDate, timezone]);

  // Compute counts per equipment
  const countsByEquipmentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const eq of equipments) {
      map.set(eq.id, 0);
    }
    for (const item of items) {
      if (item.status === 'CANCELLED' || item.status === 'RELEASED_ABSENCE') {
        continue;
      }
      if (currentDayStr && timezone) {
        const itemStartDate = new Date(item.startsAt);
        const itemEndDate = new Date(item.endsAt);
        const startDayStr = getCalendarDateInTimezone(itemStartDate, timezone);
        const endDayStr = getCalendarDateInTimezone(itemEndDate, timezone);
        if (startDayStr > currentDayStr || endDayStr < currentDayStr) {
          continue;
        }
      }
      const prev = map.get(item.equipmentId) ?? 0;
      map.set(item.equipmentId, prev + 1);
    }
    return map;
  }, [equipments, items, currentDayStr, timezone]);

  const allTabs = useMemo(() => {
    return [
      { id: '', name: 'Todos os Equipamentos', code: 'TODOS', status: 'ALL' },
      ...equipments,
    ];
  }, [equipments]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % allTabs.length;
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = allTabs.length - 1;
    } else {
      return;
    }

    const nextTab = allTabs[nextIndex];
    if (nextTab) {
      onSelectEquipment(nextTab.id);
      const tabElement = document.getElementById(`schedule-eq-tab-${nextTab.id || 'all'}`);
      tabElement?.focus();
    }
  };

  const getStatusDotClass = (status?: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'schedule-equipment-status-dot--available';
      case 'MAINTENANCE':
        return 'schedule-equipment-status-dot--maintenance';
      case 'UNAVAILABLE':
      case 'OUT_OF_SERVICE':
        return 'schedule-equipment-status-dot--out-of-service';
      case 'UNDER_EVALUATION':
        return 'schedule-equipment-status-dot--maintenance';
      default:
        return '';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponível';
      case 'MAINTENANCE':
        return 'Em manutenção';
      case 'UNAVAILABLE':
      case 'OUT_OF_SERVICE':
        return 'Indisponível';
      case 'UNDER_EVALUATION':
        return 'Sob avaliação';
      default:
        return '';
    }
  };

  return (
    <div className={`schedule-equipment-tabs-container ${className}`}>
      <div
        aria-label="Filtrar agenda por equipamento"
        className="schedule-equipment-tabs"
        role="tablist"
      >
        {/* Tab: Todos os Equipamentos */}
        <button
          aria-controls="schedule-content"
          aria-label={`Todos os Equipamentos (${equipments.length} máquinas)`}
          aria-selected={selectedEquipmentId === ''}
          className={`schedule-equipment-tab ${selectedEquipmentId === '' ? 'schedule-equipment-tab--active' : ''}`}
          id="schedule-eq-tab-all"
          onClick={() => onSelectEquipment('')}
          onKeyDown={(e) => handleKeyDown(e, 0)}
          role="tab"
          tabIndex={selectedEquipmentId === '' ? 0 : -1}
          type="button"
        >
          <span aria-hidden="true" style={{ fontSize: '1rem' }}>🔬</span>
          <span>Todos os Equipamentos</span>
          <span
            aria-label={`${equipments.length} equipamentos`}
            className="schedule-equipment-tab-badge"
          >
            {equipments.length}
          </span>
        </button>

        {/* Individual Equipment Tabs */}
        {equipments.map((eq, index) => {
          const isSelected = selectedEquipmentId === eq.id;
          const count = countsByEquipmentId.get(eq.id) ?? 0;
          const statusLabel = getStatusLabel(eq.status);

          return (
            <button
              aria-controls="schedule-content"
              aria-label={`${eq.name} (${eq.code}) - ${statusLabel}${count > 0 ? `, ${count} ${count === 1 ? 'reserva' : 'reservas'}` : ''}`}
              aria-selected={isSelected}
              className={`schedule-equipment-tab ${isSelected ? 'schedule-equipment-tab--active' : ''}`}
              id={`schedule-eq-tab-${eq.id}`}
              key={eq.id}
              onClick={() => onSelectEquipment(eq.id)}
              onKeyDown={(e) => handleKeyDown(e, index + 1)}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`schedule-equipment-status-dot ${getStatusDotClass(eq.status)}`}
                title={statusLabel}
              />
              <span className="schedule-equipment-name">{eq.name}</span>
              <span className="schedule-equipment-code-tag">{eq.code}</span>
              {count > 0 && (
                <span
                  aria-label={`${count} reservas`}
                  className="schedule-equipment-tab-badge"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
