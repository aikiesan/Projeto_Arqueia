import type {
  ScheduleBlockDetails,
  ScheduleCapabilities,
  ScheduleItem,
  ScheduleItemStatus,
  ScheduleItemType,
  ScheduleReservationDetails,
  TechnicalBlockReason,
} from '@arqueia/contracts';

export type CalendarViewMode = 'DAY' | 'WEEK';

export type ScheduleFeedbackState = 'loading' | 'empty' | 'unavailable' | 'error' | 'ready';

export interface ScheduleHourSlot {
  readonly hour: number;
  readonly label: string;
}

export interface ScheduleDayColumn {
  readonly date: Date;
  readonly dateIso: string;
  readonly formattedDayName: string;
  readonly formattedDayNumber: string;
  readonly formattedMonthName: string;
  readonly isToday: boolean;
}

export {
  type ScheduleBlockDetails,
  type ScheduleCapabilities,
  type ScheduleItem,
  type ScheduleItemStatus,
  type ScheduleItemType,
  type ScheduleReservationDetails,
  type TechnicalBlockReason,
};
