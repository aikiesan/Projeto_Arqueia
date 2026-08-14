import { describe, expect, it } from 'vitest';

import {
  cancelReservationInputSchema,
  conflictErrorResponseSchema,
  createReservationInputSchema,
  createTechnicalBlockInputSchema,
  listScheduleQuerySchema,
  scheduleResponseSchema,
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

  it('rejects recurrence until series and laboratory timezone semantics are frozen', () => {
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

    expect(() => createReservationInputSchema.parse(recurrentPayload)).toThrow(
      'Recorrência estará disponível após o endurecimento do fluxo de reserva única.',
    );
  });

  it('rejects reservations shorter than thirty minutes', () => {
    expect(() =>
      createReservationInputSchema.parse({
        laboratoryId: labId,
        equipmentId,
        projectId,
        startsAt: '2026-08-20T10:00:00.000Z',
        endsAt: '2026-08-20T10:29:59.000Z',
        purpose: 'Intervalo muito curto',
      }),
    ).toThrow('A reserva deve durar no mínimo 30 minutos.');
  });

  it('parses false query flags without coercing them to true', () => {
    const parsed = listScheduleQuerySchema.parse({
      laboratoryId: labId,
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-02T00:00:00.000Z',
      onlyMine: 'false',
      includeCancelled: 'false',
    });

    expect(parsed.onlyMine).toBe(false);
    expect(parsed.includeCancelled).toBe(false);
  });

  it('rejects schedule queries longer than forty-two days', () => {
    expect(() =>
      listScheduleQuerySchema.parse({
        laboratoryId: labId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-09-13T00:00:00.001Z',
      }),
    ).toThrow('A consulta de agenda não pode exceder 42 dias.');
  });

  it('requires laboratory scope in cancellation inputs', () => {
    expect(() =>
      cancelReservationInputSchema.parse({
        reservationId: '44444444-4444-4444-a444-444444444444',
        reason: 'Mudança de planejamento',
      }),
    ).toThrow();

    expect(
      cancelReservationInputSchema.parse({
        laboratoryId: labId,
        reservationId: '44444444-4444-4444-a444-444444444444',
        reason: 'Mudança de planejamento',
      }).laboratoryId,
    ).toBe(labId);
  });

  it('requires timezone, server capabilities and per-item cancellation capability', () => {
    const parsed = scheduleResponseSchema.parse({
      laboratoryId: labId,
      timezone: 'America/Sao_Paulo',
      startsAt: '2026-08-20T03:00:00.000Z',
      endsAt: '2026-08-21T03:00:00.000Z',
      capabilities: { canReserve: true, canManageBlocks: false },
      items: [
        {
          id: '44444444-4444-4444-a444-444444444444',
          type: 'RESERVATION',
          equipmentId,
          equipmentName: 'Cromatógrafo HPLC',
          startsAt: '2026-08-20T10:00:00.000Z',
          endsAt: '2026-08-20T12:00:00.000Z',
          title: 'Minha reserva',
          status: 'CONFIRMED',
          isMine: true,
          canCancel: true,
          reservationDetails: {
            reservationId: '44444444-4444-4444-a444-444444444444',
            userId: '55555555-5555-4555-a555-555555555555',
            projectId,
            purpose: 'Análise instrumental',
            status: 'CONFIRMED',
          },
        },
      ],
    });

    expect(parsed.timezone).toBe('America/Sao_Paulo');
    expect(parsed.items[0]?.canCancel).toBe(true);
  });

  it('formats stable conflict error response', () => {
    const conflictPayload = {
      code: 'RESERVATION_SLOT_CONFLICT' as const,
      message: 'O equipamento já está ocupado no horário selecionado.',
      requestedSlot: {
        startsAt: '2026-08-20T10:00:00.000Z',
        endsAt: '2026-08-20T12:00:00.000Z',
      },
    };

    const parsed = conflictErrorResponseSchema.parse(conflictPayload);
    expect(parsed.code).toBe('RESERVATION_SLOT_CONFLICT');
  });
});
