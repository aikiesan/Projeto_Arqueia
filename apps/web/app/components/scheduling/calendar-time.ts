export interface ScheduleSlotSelection {
  readonly date: string;
  readonly hour: number;
  readonly timezone: string;
}

export type ScheduleCalendarView = 'DAY' | 'WEEK';

interface CalendarDateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const offsetSampleHours = [-48, -24, -12, 0, 12, 24, 48] as const;

function getDateTimePartsInTimezone(date: Date, timezone: string): CalendarDateTimeParts {
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const required = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

  if (required.some((part) => values[part] === undefined)) {
    throw new RangeError(`Unable to resolve date and time in timezone: ${timezone}`);
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function parseCalendarDateTime(date: string, time: string): CalendarDateTimeParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError('Data ou horário civil inválido.');
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };
  const normalized = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day
  ) {
    throw new RangeError('Data ou horário civil inválido.');
  }

  return parts;
}

function sameCalendarDateTime(
  left: CalendarDateTimeParts,
  right: CalendarDateTimeParts,
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function getTimezoneOffsetMilliseconds(date: Date, timezone: string): number {
  const parts = getDateTimePartsInTimezone(date, timezone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(date.getTime() / 1_000) * 1_000;
}

function calendarDateToUtcDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

export function getCalendarDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!values.year || !values.month || !values.day) {
    throw new RangeError(`Unable to resolve calendar date in timezone: ${timezone}`);
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function getHourInTimezone(date: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;

  if (hour === undefined) {
    throw new RangeError(`Unable to resolve hour in timezone: ${timezone}`);
  }

  return Number(hour);
}

export function addCalendarDays(date: string, amount: number): string {
  const value = calendarDateToUtcDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function getCalendarWeekStart(date: string): string {
  const value = calendarDateToUtcDate(date);
  const weekday = value.getUTCDay();
  return addCalendarDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    ...options,
    timeZone: 'UTC',
  }).format(calendarDateToUtcDate(date));
}

export function zonedDateTimeToIso(date: string, time: string, timezone: string): string {
  const requested = parseCalendarDateTime(date, time);
  const requestedAsUtc = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
    requested.second,
  );
  const offsets = new Set(
    offsetSampleHours.map((hours) =>
      getTimezoneOffsetMilliseconds(new Date(requestedAsUtc + hours * 60 * 60 * 1_000), timezone),
    ),
  );
  const candidates = [...offsets]
    .map((offset) => new Date(requestedAsUtc - offset))
    .filter((candidate) =>
      sameCalendarDateTime(getDateTimePartsInTimezone(candidate, timezone), requested),
    );
  const uniqueCandidates = [
    ...new Map(candidates.map((candidate) => [candidate.getTime(), candidate])).values(),
  ];

  if (uniqueCandidates.length === 0) {
    throw new RangeError(
      'Este horário não existe no timezone do laboratório. Escolha outro horário.',
    );
  }
  if (uniqueCandidates.length > 1) {
    throw new RangeError(
      'Este horário é ambíguo no timezone do laboratório. Escolha outro horário.',
    );
  }

  return uniqueCandidates[0]!.toISOString();
}

export function getScheduleRangeInTimezone(
  anchor: Date,
  view: ScheduleCalendarView,
  timezone: string,
): { startsAt: string; endsAt: string } {
  const anchorDate = getCalendarDateInTimezone(anchor, timezone);
  const startsOn = view === 'DAY' ? anchorDate : getCalendarWeekStart(anchorDate);
  const endsOn = addCalendarDays(startsOn, view === 'DAY' ? 1 : 7);

  return {
    startsAt: zonedDateTimeToIso(startsOn, '00:00', timezone),
    endsAt: zonedDateTimeToIso(endsOn, '00:00', timezone),
  };
}

export function shiftCalendarDate(anchor: Date, days: number, timezone: string): Date {
  const currentDate = getCalendarDateInTimezone(anchor, timezone);
  const shiftedDate = addCalendarDays(currentDate, days);
  return new Date(zonedDateTimeToIso(shiftedDate, '12:00', timezone));
}
