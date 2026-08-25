import type { Equipment, ScheduleCapabilities, ScheduleItem } from '@arqueia/contracts';
import React, { useMemo } from 'react';

import {
  calculateEventBlockGeometry,
  formatCalendarDate,
  getCalendarDateInTimezone,
  isItemActiveInHourSlot,
  type EventBlockGeometry,
  type ScheduleSlotSelection,
  type SlotOccupationInfo,
} from './calendar-time';
import { ScheduleEventCard } from './schedule-event-card';

export interface ScheduleDayViewProps {
  readonly currentDate: Date;
  readonly timezone: string;
  readonly items: readonly ScheduleItem[];
  readonly equipments?: readonly Equipment[] | undefined;
  readonly selectedEquipmentId?: string | undefined;
  readonly onItemClick?: ((item: ScheduleItem) => void) | undefined;
  readonly onSlotClick?: ((selection: ScheduleSlotSelection) => void) | undefined;
  readonly capabilities?: ScheduleCapabilities | undefined;
  readonly startHour?: number | undefined;
  readonly endHour?: number | undefined;
  readonly className?: string | undefined;
}

interface OccupiedItemEntry {
  item: ScheduleItem;
  occupation: SlotOccupationInfo;
}

interface HourSlotData {
  hour: number;
  label: string;
  items: OccupiedItemEntry[];
}

interface PositionedLaneItem {
  item: ScheduleItem;
  geom: EventBlockGeometry;
  subColIndex: number;
  totalSubCols: number;
}

function layoutItemsInLane(
  items: readonly ScheduleItem[],
  dayDateStr: string,
  startHour: number,
  endHour: number,
  hourHeight: number,
  timezone: string,
): PositionedLaneItem[] {
  const visible: { item: ScheduleItem; geom: EventBlockGeometry }[] = [];

  for (const item of items) {
    const geom = calculateEventBlockGeometry(
      item,
      dayDateStr,
      startHour,
      endHour,
      hourHeight,
      timezone,
    );
    if (geom.isVisible && geom.height > 0) {
      visible.push({ item, geom });
    }
  }

  visible.sort((a, b) => {
    if (a.geom.top !== b.geom.top) {
      return a.geom.top - b.geom.top;
    }
    return b.geom.height - a.geom.height;
  });

  const clusters: { item: ScheduleItem; geom: EventBlockGeometry }[][] = [];
  let currentCluster: { item: ScheduleItem; geom: EventBlockGeometry }[] = [];
  let currentClusterEnd = -1;

  for (const entry of visible) {
    const entryStart = entry.geom.top;
    const entryEnd = entry.geom.top + entry.geom.height;

    if (currentCluster.length === 0) {
      currentCluster.push(entry);
      currentClusterEnd = entryEnd;
    } else if (entryStart < currentClusterEnd) {
      currentCluster.push(entry);
      currentClusterEnd = Math.max(currentClusterEnd, entryEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [entry];
      currentClusterEnd = entryEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedLaneItem[] = [];

  for (const cluster of clusters) {
    const columns: { item: ScheduleItem; geom: EventBlockGeometry }[][] = [];

    for (const entry of cluster) {
      let placed = false;
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx]!;
        const lastInCol = col[col.length - 1]!;
        const lastEnd = lastInCol.geom.top + lastInCol.geom.height;
        if (entry.geom.top >= lastEnd) {
          col.push(entry);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([entry]);
      }
    }

    const totalSubCols = columns.length;
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx]!;
      for (const entry of col) {
        result.push({
          item: entry.item,
          geom: entry.geom,
          subColIndex: colIdx,
          totalSubCols,
        });
      }
    }
  }

  return result;
}

export function ScheduleDayView({
  currentDate,
  timezone,
  items,
  equipments,
  selectedEquipmentId,
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
      items.filter((item) => {
        const itemStartDate = new Date(item.startsAt);
        const itemEndDate = new Date(item.endsAt);
        const startDayStr = getCalendarDateInTimezone(itemStartDate, timezone);
        const endDayStr = getCalendarDateInTimezone(itemEndDate, timezone);
        return startDayStr <= currentDayStr && endDayStr >= currentDayStr;
      }),
    [currentDayStr, items, timezone],
  );

  const canCreateInSlot = Boolean(onSlotClick && capabilities?.canReserve === true);
  const isMultiLaneMode = Boolean(
    (!selectedEquipmentId || selectedEquipmentId === '') &&
      equipments &&
      equipments.length > 0,
  );

  // Hours list for the grid
  const hoursList = useMemo(() => {
    const list: { hour: number; label: string }[] = [];
    for (let h = startHour; h <= endHour; h++) {
      list.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
      });
    }
    return list;
  }, [startHour, endHour]);

  // Fallback single-column slot data
  const singleColumnSlots: HourSlotData[] = useMemo(() => {
    if (isMultiLaneMode) return [];
    const relevantItems = selectedEquipmentId
      ? dayItems.filter((i) => i.equipmentId === selectedEquipmentId)
      : dayItems;

    return hoursList.map(({ hour, label }) => {
      const itemsInHour: OccupiedItemEntry[] = relevantItems
        .map((item) => ({
          item,
          occupation: isItemActiveInHourSlot(item, currentDayStr, hour, timezone),
        }))
        .filter(({ occupation }) => occupation.isOccupied);

      return {
        hour,
        label,
        items: itemsInHour,
      };
    });
  }, [isMultiLaneMode, selectedEquipmentId, dayItems, hoursList, currentDayStr, timezone]);

  // Compute positioned lane items for each equipment
  const laneLayoutsByEquipment = useMemo(() => {
    if (!isMultiLaneMode || !equipments) return new Map<string, PositionedLaneItem[]>();
    const map = new Map<string, PositionedLaneItem[]>();
    for (const eq of equipments) {
      const eqItems = dayItems.filter((i) => i.equipmentId === eq.id);
      const positioned = layoutItemsInLane(
        eqItems,
        currentDayStr,
        startHour,
        endHour,
        64,
        timezone,
      );
      map.set(eq.id, positioned);
    }
    return map;
  }, [isMultiLaneMode, equipments, dayItems, currentDayStr, startHour, endHour, timezone]);

  // If in Multi-Lane Mode ("Todos os Equipamentos" and equipments list available)
  if (isMultiLaneMode && equipments && equipments.length > 0) {
    const gridTemplateCols = `68px repeat(${equipments.length}, minmax(220px, 1fr))`;
    const totalGridHeight = hoursList.length * 64;

    return (
      <div className={`schedule-day-view schedule-day-view--lanes ${className}`}>
        <div className="schedule-day-header">
          <div>
            <h3 className="schedule-day-title">{formattedDayHeader}</h3>
            <span className="schedule-day-subtitle">
              {dayItems.length}{' '}
              {dayItems.length === 1 ? 'compromisso no dia' : 'compromissos no dia'} •{' '}
              {equipments.length} {equipments.length === 1 ? 'equipamento' : 'equipamentos'} (Visualização por Raias)
            </span>
          </div>
        </div>

        <div
          aria-label={`Grade horária de ${formattedDayHeader}`}
          className="schedule-day-lanes-container"
          role="region"
        >
          {/* Sticky Resource Lanes Header */}
          <div
            className="schedule-day-lanes-header"
            style={{ gridTemplateColumns: gridTemplateCols }}
          >
            <div className="schedule-day-lane-header-time-col">HORA</div>
            {equipments.map((eq) => {
              const eqItems = dayItems.filter(
                (i) =>
                  i.equipmentId === eq.id &&
                  i.status !== 'CANCELLED' &&
                  i.status !== 'RELEASED_ABSENCE',
              );

              return (
                <div className="schedule-day-lane-header-col" key={eq.id}>
                  <div className="schedule-day-lane-header-title">
                    <span
                      aria-hidden="true"
                      className={`schedule-equipment-status-dot ${
                        eq.status === 'AVAILABLE'
                          ? 'schedule-equipment-status-dot--available'
                          : eq.status === 'MAINTENANCE'
                            ? 'schedule-equipment-status-dot--maintenance'
                            : 'schedule-equipment-status-dot--out-of-service'
                      }`}
                    />
                    <span>{eq.name}</span>
                  </div>
                  <div className="schedule-day-lane-header-meta">
                    <span className="schedule-equipment-code-tag">{eq.code}</span>
                    <span>
                      {eqItems.length}{' '}
                      {eqItems.length === 1 ? 'agendamento' : 'agendamentos'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Grid Body */}
          <div
            className="schedule-day-lanes-body"
            style={{
              gridTemplateColumns: gridTemplateCols,
              height: `${totalGridHeight}px`,
            }}
          >
            {/* Column 0: Time Gutter */}
            <div className="schedule-day-lane-time-gutter">
              {hoursList.map(({ hour, label }) => (
                <div className="schedule-day-lane-time-cell" key={hour}>
                  <time dateTime={`${currentDayStr}T${label}`}>{label}</time>
                </div>
              ))}
            </div>

            {/* Columns 1..N: Each Equipment Resource Lane */}
            {equipments.map((eq) => {
              const positionedItems = laneLayoutsByEquipment.get(eq.id) ?? [];

              return (
                <div
                  className="schedule-day-lane-column"
                  data-equipment-id={eq.id}
                  key={eq.id}
                >
                  {/* Slot Click Targets (Background Layer) */}
                  <div className="schedule-day-lane-slots">
                    {hoursList.map(({ hour, label }) => {
                      const slotKey = `${eq.id}-${hour}`;
                      return (
                        <div
                          aria-label={`Horário disponível para ${eq.name} às ${label}`}
                          className={`schedule-day-lane-slot ${
                            canCreateInSlot ? 'schedule-day-lane-slot--clickable' : ''
                          }`}
                          key={slotKey}
                          onClick={
                            canCreateInSlot && onSlotClick
                              ? () =>
                                  onSlotClick({
                                    date: currentDayStr,
                                    hour,
                                    timezone,
                                    equipmentId: eq.id,
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
                                      hour,
                                      timezone,
                                      equipmentId: eq.id,
                                    });
                                  }
                                }
                              : undefined
                          }
                          role={canCreateInSlot ? 'button' : undefined}
                          tabIndex={canCreateInSlot ? 0 : undefined}
                        />
                      );
                    })}
                  </div>

                  {/* Continuous Event Blocks (Foreground Layer) */}
                  <div className="schedule-day-lane-events">
                    {positionedItems.map(({ item, geom, subColIndex, totalSubCols }) => {
                      const widthPercent = 100 / totalSubCols;
                      const leftPercent = subColIndex * widthPercent;

                      return (
                        <ScheduleEventCard
                          isContinuous={true}
                          item={item}
                          key={`${item.id}-${eq.id}`}
                          onClick={onItemClick}
                          style={{
                            position: 'absolute',
                            top: `${geom.top}px`,
                            height: `${geom.height}px`,
                            left: `${leftPercent}%`,
                            width: `calc(${widthPercent}% - 4px)`,
                            zIndex: 4,
                          }}
                          timezone={timezone}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Standard Single Column Day View (for focused equipment or fallback)
  const selectedEquipment = equipments?.find((e) => e.id === selectedEquipmentId);

  return (
    <div className={`schedule-day-view ${className}`}>
      <div className="schedule-day-header">
        <h3 className="schedule-day-title">{formattedDayHeader}</h3>
        <span className="schedule-day-subtitle">
          {selectedEquipment ? `${selectedEquipment.name} • ` : ''}
          {dayItems.length}{' '}
          {dayItems.length === 1 ? 'compromisso no dia' : 'compromissos no dia'}
        </span>
      </div>

      <div
        aria-label={`Grade horária de ${formattedDayHeader}`}
        className="schedule-day-grid"
        role="region"
      >
        {singleColumnSlots.map((slot) => {
          const hasItems = slot.items.length > 0;

          return (
            <div
              className={`schedule-day-slot-row ${
                hasItems
                  ? 'schedule-day-slot-row--occupied'
                  : 'schedule-day-slot-row--free'
              }`}
              key={slot.hour}
            >
              <div className="schedule-day-slot-time">
                <time
                  dateTime={`${currentDayStr}T${String(slot.hour).padStart(2, '0')}:00`}
                >
                  {slot.label}
                </time>
              </div>

              <div className="schedule-day-slot-content">
                {hasItems ? (
                  <div className="schedule-day-slot-items">
                    {slot.items.map(({ item, occupation }) => (
                      <ScheduleEventCard
                        isContinuation={occupation.isContinuation}
                        item={item}
                        key={`${item.id}-${slot.hour}`}
                        onClick={onItemClick}
                        timezone={timezone}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    aria-label={`Horário disponível às ${slot.label}`}
                    className={`schedule-day-slot-empty ${
                      canCreateInSlot ? 'schedule-day-slot-empty--clickable' : ''
                    }`}
                    onClick={
                      canCreateInSlot && onSlotClick
                        ? () =>
                            onSlotClick({
                              date: currentDayStr,
                              hour: slot.hour,
                              timezone,
                              ...(selectedEquipmentId
                                ? { equipmentId: selectedEquipmentId }
                                : {}),
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
                                ...(selectedEquipmentId
                                  ? { equipmentId: selectedEquipmentId }
                                  : {}),
                              });
                            }
                          }
                        : undefined
                    }
                    role={canCreateInSlot ? 'button' : undefined}
                    tabIndex={canCreateInSlot ? 0 : undefined}
                  >
                    <span className="schedule-day-slot-empty-text">
                      {canCreateInSlot ? '+ Reservar este horário' : 'Disponível'}
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
