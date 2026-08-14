import { describe, expect, it } from 'vitest';

import {
  conflictErrorResponseSchema,
  createReservationInputSchema,
  createTechnicalBlockInputSchema,
  listScheduleQuerySchema,
} from './index.js';

describe('Scheduling Contracts (Checkpoint A1)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const equipmentId = '22222222-2222-4222-a222-222222222222';
  const projectId = '33333333-3333-4333-a333-333333333333';

  it('validates a correct reservation input', () => {
    const validPayload = {
      laboratoryId: labId,
      equipmentId,
      projectId,
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T12:00:00.000Z',
      purpose: 'Análise de Espectrometria de Massa',
      sampleCount: 5,
      notes: 'Amostras preparadas em tampão fosfato.',
    };

    const parsed = createReservationInputSchema.parse(validPayload);
    expect(parsed.laboratoryId).toBe(labId);
    expect(parsed.projectId).toBe(projectId);
    expect(parsed.sampleCount).toBe(5);
  });

  it('rejects reservation input if projectId is missing', () => {
    const invalidPayload = {
      laboratoryId: labId,
      equipmentId,
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T12:00:00.000Z',
      purpose: 'Análise sem projeto',
    };

    expect(() => createReservationInputSchema.parse(invalidPayload)).toThrow();
  });

  it('rejects reservation input if startsAt >= endsAt', () => {
    const invertedPayload = {
      laboratoryId: labId,
      equipmentId,
      projectId,
      startsAt: '2026-08-20T14:00:00.000Z',
      endsAt: '2026-08-20T10:00:00.000Z',
      purpose: 'Horário invertido',
    };

    expect(() => createReservationInputSchema.parse(invertedPayload)).toThrow(
      'A data/hora de início deve ser anterior à data/hora de término.',
    );
  });

  it('validates technical block input correctly', () => {
    const validBlockPayload = {
      laboratoryId: labId,
      equipmentId,
      reason: 'MAINTENANCE',
      description: 'Manutenção preventiva semestral do laser',
      startsAt: '2026-08-21T08:00:00.000Z',
      endsAt: '2026-08-21T18:00:00.000Z',
    };

    const parsed = createTechnicalBlockInputSchema.parse(validBlockPayload);
    expect(parsed.reason).toBe('MAINTENANCE');
  });

  it('validates schedule list query filters', () => {
    const validQuery = {
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-31T23:59:59.000Z',
      onlyMine: 'true',
    };

    const parsed = listScheduleQuerySchema.parse(validQuery);
    expect(parsed.onlyMine).toBe(true);
  });

  it('validates recurrence rule in reservation input', () => {
    const recurrentPayload = {
      laboratoryId: labId,
      equipmentId,
      projectId,
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T12:00:00.000Z',
      purpose: 'Ensaio recorrente de estabilidade',
      recurrence: {
        frequency: 'CUSTOM' as const,
        weekdays: [1, 3, 5],
        untilDate: '2026-09-30T23:59:59.000Z',
      },
    };

    const parsed = createReservationInputSchema.parse(recurrentPayload);
    expect(parsed.recurrence?.frequency).toBe('CUSTOM');
    expect(parsed.recurrence?.weekdays).toEqual([1, 3, 5]);
  });

  it('formats stable conflict error response', () => {
    const conflictPayload = {
      code: 'RESERVATION_SLOT_CONFLICT' as const,
      message: 'O equipamento já está ocupado no horário selecionado.',
      conflictingSlot: {
        startsAt: '2026-08-20T10:00:00.000Z',
        endsAt: '2026-08-20T12:00:00.000Z',
        type: 'RESERVATION' as const,
      },
    };

    const parsed = conflictErrorResponseSchema.parse(conflictPayload);
    expect(parsed.code).toBe('RESERVATION_SLOT_CONFLICT');
  });
});
