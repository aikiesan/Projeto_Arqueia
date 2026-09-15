import {
  cancelReservationInputSchema,
  cancelTechnicalBlockInputSchema,
  checkInByEquipmentInputSchema,
  checkInReservationInputSchema,
  completeReservationInputSchema,
  conflictErrorResponseSchema,
  createReservationInputSchema,
  createReservationResultSchema,
  createTechnicalBlockInputSchema,
  releaseAbsentReservationsInputSchema,
  releaseAbsentReservationsResultSchema,
  reservationSchema,
  startWalkInReservationInputSchema,
  technicalBlockSchema,
  uuidSchema,
} from '@arqueia/contracts';
import type { z } from 'zod';

import { authorizedApiRequest, hasTrustedOrigin, noStoreJson } from '../../../lib/api-server';

interface MutationRoute {
  readonly inputSchema: z.ZodType;
  readonly responseSchema: z.ZodType;
  readonly laboratoryId: (input: Record<string, unknown>) => unknown;
  readonly upstreamBody: (input: Record<string, unknown>) => unknown;
}

function routeContract(pathname: string): MutationRoute | null {
  if (pathname === '/api/scheduling/reservations') {
    return {
      inputSchema: createReservationInputSchema,
      responseSchema: createReservationResultSchema,
      laboratoryId: (input) => input.laboratoryId,
      upstreamBody: (input) => input,
    };
  }
  if (pathname === '/api/scheduling/reservations/walk-in') {
    return {
      inputSchema: startWalkInReservationInputSchema,
      responseSchema: reservationSchema,
      laboratoryId: (input) => input.laboratoryId,
      upstreamBody: (input) => input,
    };
  }
  if (pathname === '/api/scheduling/reservations/release-absent') {
    return {
      inputSchema: releaseAbsentReservationsInputSchema,
      responseSchema: releaseAbsentReservationsResultSchema,
      laboratoryId: (input) => input.laboratoryId,
      upstreamBody: (input) => input,
    };
  }
  if (pathname === '/api/scheduling/blocks') {
    return {
      inputSchema: createTechnicalBlockInputSchema,
      responseSchema: technicalBlockSchema,
      laboratoryId: (input) => input.laboratoryId,
      upstreamBody: (input) => input,
    };
  }
  return null;
}

function parameterizedContract(pathname: string, payload: unknown): {
  readonly route: MutationRoute;
  readonly input: Record<string, unknown>;
} | null {
  const checkInMatch = pathname.match(/^\/api\/scheduling\/reservations\/([^/]+)\/check-in$/);
  if (checkInMatch) {
    const id = uuidSchema.safeParse(decodeURIComponent(checkInMatch[1] ?? ''));
    if (!id.success || typeof payload !== 'object' || payload === null) return null;
    const input = { ...(payload as Record<string, unknown>), reservationId: id.data };
    return {
      input,
      route: {
        inputSchema: checkInReservationInputSchema,
        responseSchema: reservationSchema,
        laboratoryId: (value) => value.laboratoryId,
        upstreamBody: (value) => ({ laboratoryId: value.laboratoryId }),
      },
    };
  }

  // Check-in pela leitura do QR do equipamento. O corpo enviado ao upstream leva
  // apenas o laboratoryId: quem resolve a reserva é a API, sob transação.
  const equipmentCheckInMatch = pathname.match(/^\/api\/scheduling\/equipment\/([^/]+)\/check-in$/);
  if (equipmentCheckInMatch) {
    const id = uuidSchema.safeParse(decodeURIComponent(equipmentCheckInMatch[1] ?? ''));
    if (!id.success || typeof payload !== 'object' || payload === null) return null;
    const input = { ...(payload as Record<string, unknown>), equipmentId: id.data };
    return {
      input,
      route: {
        inputSchema: checkInByEquipmentInputSchema,
        responseSchema: reservationSchema,
        laboratoryId: (value) => value.laboratoryId,
        upstreamBody: (value) => ({ laboratoryId: value.laboratoryId }),
      },
    };
  }

  const completeMatch = pathname.match(/^\/api\/scheduling\/reservations\/([^/]+)\/complete$/);
  if (completeMatch) {
    const id = uuidSchema.safeParse(decodeURIComponent(completeMatch[1] ?? ''));
    if (!id.success || typeof payload !== 'object' || payload === null) return null;
    const input = { ...(payload as Record<string, unknown>), reservationId: id.data };
    return {
      input,
      route: {
        inputSchema: completeReservationInputSchema,
        responseSchema: reservationSchema,
        laboratoryId: (value) => value.laboratoryId,
        upstreamBody: (value) => ({ laboratoryId: value.laboratoryId, notes: value.notes }),
      },
    };
  }

  const reservationCancelMatch = pathname.match(/^\/api\/scheduling\/reservations\/([^/]+)\/cancel$/);
  if (reservationCancelMatch) {
    const id = uuidSchema.safeParse(decodeURIComponent(reservationCancelMatch[1] ?? ''));
    if (!id.success || typeof payload !== 'object' || payload === null) return null;
    const input = { ...(payload as Record<string, unknown>), reservationId: id.data };
    return {
      input,
      route: {
        inputSchema: cancelReservationInputSchema,
        responseSchema: reservationSchema,
        laboratoryId: (value) => value.laboratoryId,
        upstreamBody: (value) => ({
          laboratoryId: value.laboratoryId,
          reason: value.reason,
        }),
      },
    };
  }

  const blockCancelMatch = pathname.match(/^\/api\/scheduling\/blocks\/([^/]+)\/cancel$/);
  if (blockCancelMatch) {
    const id = uuidSchema.safeParse(decodeURIComponent(blockCancelMatch[1] ?? ''));
    if (!id.success || typeof payload !== 'object' || payload === null) return null;
    const input = { ...(payload as Record<string, unknown>), technicalBlockId: id.data };
    return {
      input,
      route: {
        inputSchema: cancelTechnicalBlockInputSchema,
        responseSchema: technicalBlockSchema,
        laboratoryId: (value) => value.laboratoryId,
        upstreamBody: (value) => ({
          laboratoryId: value.laboratoryId,
          reason: value.reason,
        }),
      },
    };
  }

  return null;
}

export function GET(): Promise<Response> {
  return Promise.resolve(noStoreJson({ code: 'METHOD_NOT_ALLOWED' }, 405));
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return noStoreJson({ code: 'INVALID_ORIGIN' }, 403);
  }

  const url = new URL(request.url);
  const payload: unknown = await request.json().catch(() => null);
  const parameterized = parameterizedContract(url.pathname, payload);
  const contract = parameterized?.route ?? routeContract(url.pathname);
  const inputPayload = parameterized?.input ?? payload;
  if (!contract) return noStoreJson({ code: 'ROUTE_NOT_FOUND' }, 404);

  const parsedInput = contract.inputSchema.safeParse(inputPayload);
  if (!parsedInput.success || typeof parsedInput.data !== 'object' || parsedInput.data === null) {
    return noStoreJson({ code: 'INVALID_SCHEDULING_INPUT' }, 400);
  }
  const input = parsedInput.data as Record<string, unknown>;
  const laboratoryId = contract.laboratoryId(input);
  if (typeof laboratoryId !== 'string') {
    return noStoreJson({ code: 'INVALID_SCHEDULING_INPUT' }, 400);
  }

  const forwardedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(contract.upstreamBody(input)),
  });
  const response = await authorizedApiRequest(forwardedRequest, url.pathname, 'POST');

  if (response.status === 409) {
    const conflict: unknown = await response.json().catch(() => null);
    const parsedConflict = conflictErrorResponseSchema.safeParse(conflict);
    return parsedConflict.success
      ? noStoreJson(parsedConflict.data, 409)
      : noStoreJson({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);
  }
  if (!response.ok) return response;

  const responsePayload: unknown = await response.json();
  const parsedResponse = contract.responseSchema.safeParse(responsePayload);
  if (!parsedResponse.success) {
    return noStoreJson({ code: 'UPSTREAM_INCOMPATIBLE' }, 502);
  }

  if ('laboratoryId' in (parsedResponse.data as object)) {
    const scoped = parsedResponse.data as { laboratoryId?: unknown };
    if (scoped.laboratoryId !== laboratoryId) {
      return noStoreJson({ code: 'UPSTREAM_SCOPE_MISMATCH' }, 502);
    }
  } else if (
    'createdReservations' in (parsedResponse.data as object) &&
    (parsedResponse.data as { createdReservations: Array<{ laboratoryId: string }> })
      .createdReservations.some((reservation) => reservation.laboratoryId !== laboratoryId)
  ) {
    return noStoreJson({ code: 'UPSTREAM_SCOPE_MISMATCH' }, 502);
  }

  return noStoreJson(parsedResponse.data);
}
