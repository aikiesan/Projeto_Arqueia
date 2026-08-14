import { z } from 'zod';

const requestIdSchema = z.string().uuid();

export function identityRequestContext(requestId: string | undefined): {
  readonly origin: string;
  readonly requestId: string | null;
} {
  return {
    origin: 'api:http',
    requestId: requestIdSchema.safeParse(requestId).data ?? null,
  };
}
