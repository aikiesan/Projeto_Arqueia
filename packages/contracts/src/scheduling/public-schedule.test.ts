import { describe, expect, it } from 'vitest';

import {
  PUBLIC_SCHEDULE_MAX_DAYS,
  publicScheduleItemSchema,
  publicScheduleQuerySchema,
  publicScheduleResponseSchema,
} from './public-schedule.js';

const laboratoryId = '11111111-1111-4111-a111-111111111111';

describe('Contrato da agenda pública', () => {
  /**
   * Este schema é a fronteira do que sai para a internet aberta. Se alguém
   * adicionar um campo sensível ao item, este teste cai.
   */
  it('publica apenas equipamento, horário e quem reservou', () => {
    expect(Object.keys(publicScheduleItemSchema.shape).sort()).toEqual([
      'endsAt',
      'equipmentCode',
      'equipmentName',
      'inProgress',
      'reservedBy',
      'startsAt',
      'type',
    ]);
  });

  it('recusa campos sensíveis enxertados no item', () => {
    const item = {
      type: 'RESERVATION',
      equipmentName: 'Cromatógrafo Gasoso Shimadzu GC-2030NS',
      equipmentCode: 'EQ-SHIMADZU-GC2030',
      startsAt: '2026-09-15T13:00:00.000Z',
      endsAt: '2026-09-15T17:00:00.000Z',
      inProgress: false,
      reservedBy: 'Aluna de Mestrado',
    };

    expect(publicScheduleItemSchema.safeParse(item).success).toBe(true);
    for (const leak of ['email', 'purpose', 'projectId', 'notes', 'sampleCount', 'userId']) {
      expect(publicScheduleItemSchema.safeParse({ ...item, [leak]: 'x' }).success).toBe(false);
    }
  });

  it('aceita null em reservedBy para bloqueio técnico', () => {
    const parsed = publicScheduleItemSchema.safeParse({
      type: 'TECHNICAL_BLOCK',
      equipmentName: 'Cromatógrafo Gasoso Shimadzu GC-2030NS',
      equipmentCode: 'EQ-SHIMADZU-GC2030',
      startsAt: '2026-09-15T13:00:00.000Z',
      endsAt: '2026-09-15T17:00:00.000Z',
      inProgress: false,
      reservedBy: null,
    });

    expect(parsed.success).toBe(true);
  });

  it('limita a janela consultável para a página não virar dump do histórico', () => {
    const base = { laboratoryId, startsAt: '2026-09-01T00:00:00.000Z' };

    expect(
      publicScheduleQuerySchema.safeParse({ ...base, endsAt: '2026-09-08T00:00:00.000Z' }).success,
    ).toBe(true);
    expect(
      publicScheduleQuerySchema.safeParse({ ...base, endsAt: '2027-09-01T00:00:00.000Z' }).success,
    ).toBe(false);
    expect(PUBLIC_SCHEDULE_MAX_DAYS).toBe(31);
  });

  it('exige início anterior ao fim', () => {
    expect(
      publicScheduleQuerySchema.safeParse({
        laboratoryId,
        startsAt: '2026-09-08T00:00:00.000Z',
        endsAt: '2026-09-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('a resposta não carrega identificadores de usuário', () => {
    expect(Object.keys(publicScheduleResponseSchema.shape).sort()).toEqual([
      'endsAt',
      'items',
      'laboratory',
      'startsAt',
      'timezone',
    ]);
  });
});
