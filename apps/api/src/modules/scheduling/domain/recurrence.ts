export interface RecurrenceRule {
  frequency: string;
  weekdays?: number[] | undefined;
  untilDate?: string | null | undefined;
}

export interface RecurrentSlot {
  startsAt: string;
  endsAt: string;
}

const MAX_OCCURRENCES = 100;

function inclusiveUntil(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}

export function generateRecurrentSlots(
  startsAtIso: string,
  endsAtIso: string,
  recurrence?: RecurrenceRule,
): RecurrentSlot[] {
  const start = new Date(startsAtIso);
  const durationMs = new Date(endsAtIso).getTime() - start.getTime();

  if (!recurrence || recurrence.frequency === 'NONE' || !recurrence.untilDate) {
    return [{ startsAt: startsAtIso, endsAt: endsAtIso }];
  }

  const slots: RecurrentSlot[] = [];
  const until = inclusiveUntil(recurrence.untilDate);
  const current = new Date(start);
  const selectedWeekdays = recurrence.weekdays ?? [];

  while (current <= until && slots.length < MAX_OCCURRENCES) {
    const matches = recurrence.frequency !== 'CUSTOM'
      || selectedWeekdays.length === 0
      || selectedWeekdays.includes(current.getUTCDay());

    if (matches) {
      slots.push({
        startsAt: current.toISOString(),
        endsAt: new Date(current.getTime() + durationMs).toISOString(),
      });
    }

    switch (recurrence.frequency) {
      case 'WEEKLY':
        current.setUTCDate(current.getUTCDate() + 7);
        break;
      case 'FORTNIGHTLY':
        current.setUTCDate(current.getUTCDate() + 14);
        break;
      case 'MONTHLY': {
        const originalDay = start.getUTCDate();
        current.setUTCDate(1);
        current.setUTCMonth(current.getUTCMonth() + 1);
        const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
        current.setUTCDate(Math.min(originalDay, lastDay));
        break;
      }
      default:
        current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return slots.length > 0 ? slots : [{ startsAt: startsAtIso, endsAt: endsAtIso }];
}
