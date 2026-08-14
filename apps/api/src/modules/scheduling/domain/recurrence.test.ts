import { describe, expect, it } from 'vitest';

import { generateRecurrentSlots } from './recurrence.js';

describe('generateRecurrentSlots', () => {
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
});
