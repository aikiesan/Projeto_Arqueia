import 'server-only';

import {
  authenticatedPrincipalSchema,
  dashboardSummarySchema,
  equipmentPageSchema,
  laboratorySchema,
  userSchema,
  type AuthenticatedPrincipal,
  type DashboardSummary,
  type Laboratory,
  type Equipment,
  type User,
} from '@arqueia/contracts';
import { z } from 'zod';

import { apiBaseUrl, sessionToken } from './api-server';

async function authorizedGet(path: string): Promise<unknown | null> {
  const token = await sessionToken();
  if (token === null) return null;
  try {
    const upstream = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return null;
    return (await upstream.json()) as unknown;
  } catch {
    return null;
  }
}

export async function loadPrincipal(): Promise<AuthenticatedPrincipal | null> {
  const payload = await authorizedGet('/api/auth/me');
  if (payload === null) return null;
  const parsed = authenticatedPrincipalSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function loadLaboratories(): Promise<readonly Laboratory[]> {
  const payload = await authorizedGet('/api/laboratories');
  const parsed = z.array(laboratorySchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

export async function loadUsers(): Promise<readonly User[]> {
  const payload = await authorizedGet('/api/users');
  const parsed = z.array(userSchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

export async function loadLaboratoryEquipment(
  laboratoryId: string,
): Promise<{ readonly available: boolean; readonly items: readonly Equipment[] }> {
  const items: Equipment[] = [];
  let cursor: string | null = null;

  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const query = new URLSearchParams({ laboratoryId, limit: '50' });
    if (cursor !== null) query.set('cursor', cursor);
    const payload = await authorizedGet(`/api/equipment?${query.toString()}`);
    if (payload === null) return { available: false, items: [] };
    const parsed = equipmentPageSchema.safeParse(payload);
    if (!parsed.success) return { available: false, items: [] };
    items.push(...parsed.data.items);
    if (!parsed.data.pageInfo.hasNextPage || parsed.data.pageInfo.nextCursor === null) {
      return { available: true, items };
    }
    cursor = parsed.data.pageInfo.nextCursor;
  }

  return { available: false, items: [] };
}

export async function loadDashboardSummary(laboratoryId: string): Promise<DashboardSummary | null> {
  const query = new URLSearchParams({ laboratoryId });
  const payload = await authorizedGet(`/api/management/dashboard?${query.toString()}`);
  if (payload === null) return null;
  const parsed = dashboardSummarySchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
