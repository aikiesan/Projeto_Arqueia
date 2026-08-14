import type { AuthenticatedPrincipal, CatalogOptionPage } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogAccessPolicy } from '../domain/ports/catalog-access-policy.port.js';
import type { CatalogOptionReader } from '../domain/ports/catalog-option-reader.port.js';
import { ListCatalogOptionsUseCase } from './list-catalog-options.use-case.js';

const principal = {} as AuthenticatedPrincipal;
const query = {
  laboratoryId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  kind: 'EQUIPMENT_MODEL',
  limit: 25,
} as const;
const page: CatalogOptionPage = {
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
};

describe('ListCatalogOptionsUseCase', () => {
  it('authorizes the laboratory and kind before reading options', async () => {
    const order: string[] = [];
    const policy: CatalogAccessPolicy = {
      assertCanRead: vi.fn(() => order.push('authorize')),
    };
    const reader: CatalogOptionReader = {
      list: vi.fn(async () => {
        order.push('read');
        return page;
      }),
    };

    await expect(new ListCatalogOptionsUseCase(reader, policy).execute(principal, query))
      .resolves.toEqual(page);
    expect(order).toEqual(['authorize', 'read']);
    expect(policy.assertCanRead).toHaveBeenCalledWith(
      principal,
      query.laboratoryId,
      query.kind,
    );
  });

  it('does not query the database after an authorization denial', async () => {
    const denial = new Error('denied');
    const policy: CatalogAccessPolicy = {
      assertCanRead: vi.fn(() => {
        throw denial;
      }),
    };
    const reader: CatalogOptionReader = { list: vi.fn() };

    await expect(
      Promise.resolve().then(() =>
        new ListCatalogOptionsUseCase(reader, policy).execute(principal, query),
      ),
    ).rejects.toBe(denial);
    expect(reader.list).not.toHaveBeenCalled();
  });
});
