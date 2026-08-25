import { describe, expect, it } from 'vitest';

import { generateRecurrentSlots } from './recurrence.js';

describe('generateRecurrentSlots Edge Cases', () => {
  it('keeps a weekly reservation on the same weekday', () => {
    const slots = generateRecurrentSlots(
      '2026-08-10T12:00:00.000Z',
      '2026-08-10T13:00:00.000Z',
      { frequency: 'WEEKLY', untilDate: '2026-08-31' },
    );

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      '2026-08-10T12:00:00.000Z',
      '2026-08-17T12:00:00.000Z',
      '2026-08-24T12:00:00.000Z',
      '2026-08-31T12:00:00.000Z',
    ]);
  });

  it('uses only selected weekdays for a custom recurrence', () => {
    const slots = generateRecurrentSlots(
      '2026-08-10T12:00:00.000Z',
      '2026-08-10T13:00:00.000Z',
      { frequency: 'CUSTOM', weekdays: [1, 3], untilDate: '2026-08-16' },
    );

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      '2026-08-10T12:00:00.000Z',
      '2026-08-12T12:00:00.000Z',
    ]);
  });

  it('handles FORTNIGHTLY frequency (every 14 days)', () => {
    const slots = generateRecurrentSlots(
      '2026-08-01T09:00:00.000Z',
      '2026-08-01T11:00:00.000Z',
      { frequency: 'FORTNIGHTLY', untilDate: '2026-09-01' },
    );

    expect(slots.map((s) => s.startsAt)).toEqual([
      '2026-08-01T09:00:00.000Z',
      '2026-08-15T09:00:00.000Z',
      '2026-08-29T09:00:00.000Z',
    ]);
  });

  it('handles MONTHLY recurrence with month-end clipping (31st Jan -> 28th Feb)', () => {
    const slots = generateRecurrentSlots(
      '2026-01-31T10:00:00.000Z',
      '2026-01-31T12:00:00.000Z',
      { frequency: 'MONTHLY', untilDate: '2026-04-30' },
    );

    expect(slots.map((s) => s.startsAt)).toEqual([
      '2026-01-31T10:00:00.000Z',
      '2026-02-28T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      '2026-04-30T10:00:00.000Z',
    ]);
  });

  it('caps max occurrences at 100 to prevent infinite loops or memory exhaustion', () => {
    const slots = generateRecurrentSlots(
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T09:00:00.000Z',
      { frequency: 'DAILY', untilDate: '2030-01-01' },
    );

    expect(slots).toHaveLength(100);
  });

  it('returns single original slot when recurrence is NONE or missing', () => {
    const slotsNone = generateRecurrentSlots(
      '2026-08-10T12:00:00.000Z',
      '2026-08-10T13:00:00.000Z',
      { frequency: 'NONE' },
    );
    expect(slotsNone).toHaveLength(1);

    const slotsUndef = generateRecurrentSlots(
      '2026-08-10T12:00:00.000Z',
      '2026-08-10T13:00:00.000Z',
    );
    expect(slotsUndef).toHaveLength(1);
  });

  it('preserves slot duration across all generated intervals', () => {
    const slots = generateRecurrentSlots(
      '2026-08-10T08:00:00.000Z',
      '2026-08-10T11:30:00.000Z', // 3.5 hours
      { frequency: 'WEEKLY', untilDate: '2026-08-25' },
    );

    for (const slot of slots) {
      const durationHours =
        (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / (1000 * 60 * 60);
      expect(durationHours).toBe(3.5);
    }
  });
});
