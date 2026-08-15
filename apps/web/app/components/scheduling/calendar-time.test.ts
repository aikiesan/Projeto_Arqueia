import { describe, expect, it } from 'vitest';

import {
  getScheduleRangeInTimezone,
  shiftCalendarDate,
  zonedDateTimeToIso,
} from './calendar-time';

describe('calendar-time', () => {
  it('converte horário civil do laboratório para UTC', () => {
    expect(
      zonedDateTimeToIso('2026-08-20', '09:00', 'America/Sao_Paulo'),
    ).toBe('2026-08-20T12:00:00.000Z');
  });

  it('produz intervalo diário semiaberto entre duas meias-noites civis', () => {
    expect(
      getScheduleRangeInTimezone(
        new Date('2026-08-20T15:00:00.000Z'),
        'DAY',
        'America/Sao_Paulo',
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
        'America/Sao_Paulo',
      ),
    ).toEqual({
      startsAt: '2026-08-17T03:00:00.000Z',
      endsAt: '2026-08-24T03:00:00.000Z',
    });
  });

  it('navega pela data civil do laboratório sem usar o timezone do navegador', () => {
    const anchor = new Date('2026-02-02T02:30:00.000Z');

    expect(shiftCalendarDate(anchor, 1, 'America/Sao_Paulo').toISOString()).toBe(
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
});
