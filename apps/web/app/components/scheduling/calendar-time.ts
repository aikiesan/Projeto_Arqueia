export interface ScheduleSlotSelection {
  readonly date: string;
  readonly hour: number;
  readonly timezone: string;
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
