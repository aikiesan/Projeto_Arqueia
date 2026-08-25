import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  formatCalendarDate,
  getCalendarDateInTimezone,
  getCalendarWeekStart,
  getHourInTimezone,
  getScheduleRangeInTimezone,
  isItemActiveInHourSlot,
  shiftCalendarDate,
  zonedDateTimeToIso,
} from './calendar-time';

describe('calendar-time & timezone edge cases', () => {
  const spTz = 'America/Sao_Paulo';

  it('converte horário civil do laboratório para UTC', () => {
    expect(zonedDateTimeToIso('2026-08-20', '09:00', spTz)).toBe(
      '2026-08-20T12:00:00.000Z',
    );
  });

  it('produz intervalo diário semiaberto entre duas meias-noites civis', () => {
    expect(
      getScheduleRangeInTimezone(
        new Date('2026-08-20T15:00:00.000Z'),
        'DAY',
        spTz,
      ),
    ).toEqual({
      startsAt: '2026-08-20T03:00:00.000Z',
      endsAt: '2026-08-21T03:00:00.000Z',
    });
  });

  it('produz intervalo semanal semiaberto de segunda a segunda', () => {
    expect(
      getScheduleRangeInTimezone(
        new Date('2026-08-20T15:00:00.000Z'),
        'WEEK',
        spTz,
      ),
    ).toEqual({
      startsAt: '2026-08-17T03:00:00.000Z',
      endsAt: '2026-08-24T03:00:00.000Z',
    });
  });

  it('calcula início da semana corretamente para qualquer dia da semana', () => {
    // 2026-08-17 is Monday
    expect(getCalendarWeekStart('2026-08-17')).toBe('2026-08-17');
    // 2026-08-19 is Wednesday
    expect(getCalendarWeekStart('2026-08-19')).toBe('2026-08-17');
    // 2026-08-22 is Saturday
    expect(getCalendarWeekStart('2026-08-22')).toBe('2026-08-17');
    // 2026-08-23 is Sunday -> should resolve to Monday 2026-08-17
    expect(getCalendarWeekStart('2026-08-23')).toBe('2026-08-17');
  });

  it('adiciona dias civis atravessando finais de mês e ano bissexto', () => {
    expect(addCalendarDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addCalendarDays('2026-12-30', 5)).toBe('2027-01-04');
    // Leap year 2028: Feb 28 + 1 = Feb 29
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('formata datas civis em português do Brasil', () => {
    const formatted = formatCalendarDate('2026-08-20', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
    expect(formatted).toMatch(/qui/i);
    expect(formatted).toMatch(/20/);
  });

  it('extrai data e hora civil no timezone do laboratório com precisão', () => {
    // 12:00 UTC is 09:00 in America/Sao_Paulo (UTC-3)
    const date = new Date('2026-08-20T12:00:00.000Z');
    expect(getCalendarDateInTimezone(date, spTz)).toBe('2026-08-20');
    expect(getHourInTimezone(date, spTz)).toBe(9);

    // 01:00 UTC is 22:00 on previous day in America/Sao_Paulo
    const lateNightUtc = new Date('2026-08-21T01:00:00.000Z');
    expect(getCalendarDateInTimezone(lateNightUtc, spTz)).toBe('2026-08-20');
    expect(getHourInTimezone(lateNightUtc, spTz)).toBe(22);
  });

  it('navega pela data civil do laboratório sem usar o timezone do navegador', () => {
    const anchor = new Date('2026-02-02T02:30:00.000Z');

    expect(shiftCalendarDate(anchor, 1, spTz).toISOString()).toBe(
      '2026-02-02T15:00:00.000Z',
    );
  });

  it('rejeita horário civil inexistente durante avanço de DST', () => {
    expect(() =>
      zonedDateTimeToIso('2026-03-08', '02:30', 'America/New_York'),
    ).toThrow('Este horário não existe no timezone do laboratório.');
  });

  it('rejeita horário civil ambíguo durante retorno de DST', () => {
    expect(() =>
      zonedDateTimeToIso('2026-11-01', '01:30', 'America/New_York'),
    ).toThrow('Este horário é ambíguo no timezone do laboratório.');
  });

  describe('isItemActiveInHourSlot (slot rendering calculations)', () => {
    // Item runs 09:00 - 12:00 in America/Sao_Paulo (12:00 - 15:00 UTC)
    const item = {
      startsAt: '2026-08-20T12:00:00.000Z', // 09:00 SP
      endsAt: '2026-08-20T15:00:00.000Z',   // 12:00 SP
    };

    it('identifies slot before item as unoccupied', () => {
      const slot8 = isItemActiveInHourSlot(item, '2026-08-20', 8, spTz);
      expect(slot8.isOccupied).toBe(false);
    });

    it('identifies start slot (09:00)', () => {
      const slot9 = isItemActiveInHourSlot(item, '2026-08-20', 9, spTz);
      expect(slot9.isOccupied).toBe(true);
      expect(slot9.isStart).toBe(true);
      expect(slot9.isContinuation).toBe(false);
    });

    it('identifies continuation slots (10:00 and 11:00)', () => {
      const slot10 = isItemActiveInHourSlot(item, '2026-08-20', 10, spTz);
      expect(slot10.isOccupied).toBe(true);
      expect(slot10.isStart).toBe(false);
      expect(slot10.isContinuation).toBe(true);

      const slot11 = isItemActiveInHourSlot(item, '2026-08-20', 11, spTz);
      expect(slot11.isOccupied).toBe(true);
      expect(slot11.isStart).toBe(false);
      expect(slot11.isContinuation).toBe(true);
    });

    it('identifies slot at endsAt (12:00) as unoccupied because interval is semi-open [start, end)', () => {
      const slot12 = isItemActiveInHourSlot(item, '2026-08-20', 12, spTz);
      expect(slot12.isOccupied).toBe(false);
    });

    it('handles midnight transition (23:00 to 01:00 next day)', () => {
      // 23:00 SP (Day 1) to 01:00 SP (Day 2) -> 02:00 to 04:00 UTC (Day 2)
      const overnight = {
        startsAt: '2026-08-21T02:00:00.000Z', // 23:00 on Aug 20 SP
        endsAt: '2026-08-21T04:00:00.000Z',   // 01:00 on Aug 21 SP
      };

      const slot23 = isItemActiveInHourSlot(overnight, '2026-08-20', 23, spTz);
      expect(slot23.isOccupied).toBe(true);
      expect(slot23.isStart).toBe(true);

      const slot00 = isItemActiveInHourSlot(overnight, '2026-08-21', 0, spTz);
      expect(slot00.isOccupied).toBe(true);
      expect(slot00.isContinuation).toBe(true);

      const slot01 = isItemActiveInHourSlot(overnight, '2026-08-21', 1, spTz);
      expect(slot01.isOccupied).toBe(false);
    });
  });
});
