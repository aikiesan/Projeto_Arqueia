import type { AuthenticatedPrincipal } from '@arqueia/contracts';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
}
