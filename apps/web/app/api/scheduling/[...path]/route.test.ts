import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiServer from '../../../lib/api-server';
import { POST } from './route';

vi.mock('../../../lib/api-server', async (importOriginal) => {
  const actual = await importOriginal<typeof apiServer>();
  return { ...actual, authorizedApiRequest: vi.fn() };
});

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const reservationId = '22222222-2222-4222-a222-222222222222';
const equipmentId = '33333333-3333-4333-a333-333333333333';
const userId = '44444444-4444-4444-a444-444444444444';
const projectId = '55555555-5555-4555-a555-555555555555';

const reservation = {
  id: reservationId,
  laboratoryId,
  equipmentId,
  userId,
  projectId,
  startsAt: '2026-08-20T10:00:00.000Z',
  endsAt: '2026-08-20T11:00:00.000Z',
  status: 'CANCELLED',
  purpose: 'Análise instrumental',
  sampleCount: null,
  notes: null,
  cancelledAt: '2026-08-14T10:00:00.000Z',
  cancelledByUserId: userId,
  cancellationReason: 'Mudança de planejamento',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
  archivedAt: null,
};

function postRequest(path: string, body: unknown, origin = 'http://localhost:3000'): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Host: 'localhost:3000', Origin: origin },
    body: JSON.stringify(body),
  });
}

describe('BFF scheduling mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects cross-origin mutations before forwarding', async () => {
    const response = await POST(
      postRequest(
        `/api/scheduling/reservations/${reservationId}/cancel`,
        { laboratoryId, reason: 'Mudança de planejamento' },
        'https://attacker.invalid',
      ),
    );

    expect(response.status).toBe(403);
    expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
  });

  it('validates laboratory-scoped cancellation and its upstream response', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json(reservation, { status: 200 }),
    );
    const request = postRequest(`/api/scheduling/reservations/${reservationId}/cancel`, {
      laboratoryId,
      reason: 'Mudança de planejamento',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const forwardedRequest = vi.mocked(apiServer.authorizedApiRequest).mock.calls[0]?.[0];
    await expect(forwardedRequest?.json()).resolves.toEqual({
      laboratoryId,
      reason: 'Mudança de planejamento',
    });
    expect(apiServer.authorizedApiRequest).toHaveBeenCalledWith(
      forwardedRequest,
      `/api/scheduling/reservations/${reservationId}/cancel`,
      'POST',
    );
  });

  it('validates recurrence at the BFF and forwards it upstream', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json(
        {
          createdReservations: [reservation],
          conflictingSlots: [],
        },
        { status: 201 },
      ),
    );

    const request = postRequest('/api/scheduling/reservations', {
      laboratoryId,
      equipmentId,
      projectId,
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T11:00:00.000Z',
      purpose: 'Análise instrumental',
      recurrence: {
        frequency: 'WEEKLY',
        weekdays: [],
        untilDate: '2026-09-20T10:00:00.000Z',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(apiServer.authorizedApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      '/api/scheduling/reservations',
      'POST',
    );
  });

  it('validates conflict responses without exposing another reservation', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json(
        {
          code: 'RESERVATION_SLOT_CONFLICT',
          message: 'O equipamento já está ocupado no horário selecionado.',
          requestedSlot: {
            startsAt: '2026-08-20T10:00:00.000Z',
            endsAt: '2026-08-20T11:00:00.000Z',
          },
        },
        { status: 409 },
      ),
    );
    const request = postRequest('/api/scheduling/reservations', {
      laboratoryId,
      equipmentId,
      projectId,
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T11:00:00.000Z',
      purpose: 'Análise instrumental',
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).not.toHaveProperty('conflictingReservation');
    expect(body.requestedSlot).toEqual({
      startsAt: '2026-08-20T10:00:00.000Z',
      endsAt: '2026-08-20T11:00:00.000Z',
    });
  });

  describe('check-in pela etiqueta do equipamento', () => {
    const checkInPath = `/api/scheduling/equipment/${equipmentId}/check-in`;
    const startedReservation = { ...reservation, status: 'IN_PROGRESS', startedAt: '2026-08-20T10:00:00.000Z' };

    it('rejeita origem não confiável antes de encaminhar', async () => {
      const response = await POST(
        postRequest(checkInPath, { laboratoryId }, 'https://attacker.invalid'),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 'INVALID_ORIGIN' });
      expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
    });

    it('encaminha somente o laboratoryId para a API', async () => {
      vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
        new Response(JSON.stringify(startedReservation), { status: 200 }),
      );

      const response = await POST(postRequest(checkInPath, { laboratoryId }));

      expect(response.status).toBe(200);
      const forwarded = vi.mocked(apiServer.authorizedApiRequest).mock.calls[0];
      expect(forwarded?.[1]).toBe(checkInPath);
      expect(await (forwarded?.[0] as Request).json()).toEqual({ laboratoryId });
    });

    /** O contrato é .strict(): o cliente não escolhe a reserva nem por tabela. */
    it('recusa payload com campos extras, como reservationId', async () => {
      const response = await POST(
        postRequest(checkInPath, { laboratoryId, reservationId: 'nao-deve-passar' }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: 'INVALID_SCHEDULING_INPUT' });
      expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
    });

    /**
     * Regressão: o handler intercepta todo 409 e o valida contra
     * conflictErrorResponseSchema. Por isso a recusa de check-in usa 422, que
     * precisa chegar ao cliente com o corpo intacto.
     */
    it('repassa a recusa 422 sem alterar o corpo', async () => {
      const refusal = {
        code: 'RESERVATION_OF_ANOTHER_USER',
        message: 'Este equipamento está reservado por outro usuário no momento.',
        nextReservationStartsAt: null,
        occupiedUntil: '2026-08-20T11:00:00.000Z',
      };
      vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
        new Response(JSON.stringify(refusal), { status: 422 }),
      );

      const response = await POST(postRequest(checkInPath, { laboratoryId }));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual(refusal);
    });

    it('barra resposta de outro laboratório', async () => {
      vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
        new Response(
          JSON.stringify({ ...startedReservation, laboratoryId: '99999999-9999-4999-a999-999999999999' }),
          { status: 200 },
        ),
      );

      const response = await POST(postRequest(checkInPath, { laboratoryId }));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ code: 'UPSTREAM_SCOPE_MISMATCH' });
    });

    it('não roteia equipmentId que não seja uuid', async () => {
      const response = await POST(
        postRequest('/api/scheduling/equipment/nao-e-uuid/check-in', { laboratoryId }),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'ROUTE_NOT_FOUND' });
      expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
    });
  });
});
