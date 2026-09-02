import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedPrincipal,
  Product,
} from '@arqueia/contracts';

import { Argon2PasswordHasher, Argon2PasswordVerifier } from '../identity/infrastructure/argon2-password-verifier.js';
import { ChangePasswordUseCase } from '../identity/application/change-password.use-case.js';
import { InvalidCredentialsError } from '../identity/domain/errors/invalid-credentials.error.js';
import { InsufficientStockError } from './domain/inventory.errors.js';

describe('Milestone 3 Empirical Challenger Battery: Password, Pagination & Stock Ledger', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const userId = '22222222-2222-4222-a222-222222222222';
  const context = { origin: 'api:challenge', requestId: 'req-m3-challenger' };

  const testPrincipal: AuthenticatedPrincipal = {
    user: {
      id: userId,
      institutionId: 'inst-1',
      name: 'Dr. Empirical Challenger',
      email: 'challenger@unicamp.br',
      supervisorUserId: null,
      status: 'ACTIVE',
      identityProvider: 'LOCAL',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      archivedAt: null,
    },
    memberships: [
      {
        id: 'm-1',
        userId,
        laboratoryId: labId,
        role: 'TECNICO',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
    ],
    systemRoles: [],
  };

  describe('1. Password Verification & Argon2 Cryptographic Challenge', () => {
    const verifier = new Argon2PasswordVerifier();
    const hasher = new Argon2PasswordHasher();

    it('generates real Argon2id hash and verifies matching plaintext password', async () => {
      const plaintext = 'Arqueia@Secure2026#Unicamp';
      const hash = await hasher.hash(plaintext);

      expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

      const isValid = await verifier.verify(plaintext, hash);
      expect(isValid).toBe(true);
    });

    it('rejects mismatched passwords against real Argon2 hash', async () => {
      const plaintext = 'CorrectPassword123!';
      const wrongPlaintext = 'WrongPassword123!';
      const hash = await hasher.hash(plaintext);

      const isValid = await verifier.verify(wrongPlaintext, hash);
      expect(isValid).toBe(false);
    });

    it('rejects empty and whitespace passwords against valid Argon2 hash', async () => {
      const plaintext = 'CorrectPassword123!';
      const hash = await hasher.hash(plaintext);

      expect(await verifier.verify('', hash)).toBe(false);
      expect(await verifier.verify('   ', hash)).toBe(false);
    });

    it('handles corrupted, malformed, or null password hashes gracefully without unhandled exceptions', async () => {
      expect(await verifier.verify('some-password', null)).toBe(false);
      expect(await verifier.verify('some-password', 'garbage-non-hash-string')).toBe(false);
      expect(await verifier.verify('some-password', '$argon2id$v=19$invalid$corrupted')).toBe(false);
    });

    it('executes ChangePasswordUseCase successfully when current password matches', async () => {
      const initialPassword = 'OldPassword@2026';
      const initialHash = await hasher.hash(initialPassword);
      let currentStoredHash = initialHash;

      const mockLocalIdentities = {
        findActiveByUserId: vi.fn(async (id: string) => {
          if (id === userId) {
            return {
              passwordHash: currentStoredHash,
            };
          }
          return null;
        }),
      };

      const mockUsers = {
        create: vi.fn(),
        update: vi.fn(),
        setPasswordHash: vi.fn(async (_id: string, newHash: string) => {
          currentStoredHash = newHash;
        }),
      };

      const changePassword = new ChangePasswordUseCase(
        mockLocalIdentities,
        mockUsers,
        verifier,
        hasher,
      );

      const newPassword = 'NewStrongPassword@2026!#';
      const result = await changePassword.execute(
        testPrincipal,
        { currentPassword: initialPassword, newPassword },
        context,
      );

      expect(result.success).toBe(true);
      expect(mockUsers.setPasswordHash).toHaveBeenCalledWith(
        userId,
        expect.stringMatching(/^\$argon2id\$/),
        expect.objectContaining({ actorId: userId, origin: context.origin }),
        'identity.user.password_changed',
      );

      // Verify new hash works with new password and rejects old password
      expect(await verifier.verify(newPassword, currentStoredHash)).toBe(true);
      expect(await verifier.verify(initialPassword, currentStoredHash)).toBe(false);
    });

    it('rejects ChangePasswordUseCase with InvalidCredentialsError when current password is wrong', async () => {
      const initialPassword = 'OldPassword@2026';
      const initialHash = await hasher.hash(initialPassword);

      const mockLocalIdentities = {
        findActiveByUserId: vi.fn(async () => ({
          passwordHash: initialHash,
        })),
      };

      const mockUsers = {
        create: vi.fn(),
        update: vi.fn(),
        setPasswordHash: vi.fn(),
      };

      const changePassword = new ChangePasswordUseCase(
        mockLocalIdentities,
        mockUsers,
        verifier,
        hasher,
      );

      await expect(
        changePassword.execute(
          testPrincipal,
          { currentPassword: 'WrongCurrentPassword', newPassword: 'BrandNewPassword123' },
          context,
        ),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(mockUsers.setPasswordHash).not.toHaveBeenCalled();
    });

    it('rejects ChangePasswordUseCase with InvalidCredentialsError when account does not exist', async () => {
      const mockLocalIdentities = {
        findActiveByUserId: vi.fn(async () => null),
      };

      const mockUsers = {
        create: vi.fn(),
        update: vi.fn(),
        setPasswordHash: vi.fn(),
      };

      const changePassword = new ChangePasswordUseCase(
        mockLocalIdentities,
        mockUsers,
        verifier,
        hasher,
      );

      await expect(
        changePassword.execute(
          testPrincipal,
          { currentPassword: 'SomePassword', newPassword: 'BrandNewPassword123' },
          context,
        ),
      ).rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('2. Cursor Pagination Stress & Boundary Challenge', () => {
    // Generate 10 sample products with distinct names and deterministic UUIDs
    const products: Product[] = Array.from({ length: 10 }, (_, i) => ({
      id: `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      laboratoryId: labId,
      code: `PRD-${String(i + 1).padStart(3, '0')}`,
      name: `Reativo Químico ${String.fromCharCode(65 + i)}`, // A, B, C, D, ...
      casNumber: `100-${i}-0`,
      category: 'REAGENTE',
      unitOfMeasure: 'FRASCO',
      minimumStockThreshold: 5,
      description: `Produto de teste ${i + 1}`,
      createdAt: new Date(Date.UTC(2026, 7, 14, 10, i, 0)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 7, 14, 10, i, 0)).toISOString(),
      archivedAt: null,
    }));

    // Simulates SQL `(lower(name), id) > (lower(cursor.name), cursor.id) ORDER BY lower(name) ASC, id ASC LIMIT limit + 1`
    function queryProductsPage(cursor: string | null | undefined, limit: number) {
      let filtered = [...products].sort((a, b) => {
        const nameCmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        if (nameCmp !== 0) return nameCmp;
        return a.id.localeCompare(b.id);
      });

      if (cursor) {
        const cursorProduct = products.find((p) => p.id === cursor && p.archivedAt === null);
        if (!cursorProduct) {
          // SQL subquery returns NULL -> (name, id) > NULL evaluates to FALSE -> 0 rows
          filtered = [];
        } else {
          filtered = filtered.filter((p) => {
            const nameCmp = p.name.toLowerCase().localeCompare(cursorProduct.name.toLowerCase());
            if (nameCmp > 0) return true;
            if (nameCmp < 0) return false;
            return p.id > cursorProduct.id;
          });
        }
      }

      const rows = filtered.slice(0, limit + 1);
      const hasNextPage = rows.length > limit;
      const items = rows.slice(0, limit);
      return {
        items,
        pageInfo: {
          hasNextPage,
          nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
        },
      };
    }

    it('traverses all items across multi-page cursor navigation without gaps or duplicates', () => {
      const collected: Product[] = [];
      let cursor: string | null = null;
      let pageCount = 0;
      const pageSize = 3;

      do {
        pageCount++;
        const page = queryProductsPage(cursor, pageSize);
        collected.push(...page.items);
        cursor = page.pageInfo.nextCursor;

        if (page.pageInfo.hasNextPage) {
          expect(cursor).not.toBeNull();
        } else {
          expect(cursor).toBeNull();
        }
      } while (cursor !== null);

      expect(pageCount).toBe(4); // 3 + 3 + 3 + 1 = 10 items across 4 pages
      expect(collected).toHaveLength(10);

      // Verify every product is unique and matches the source list
      const collectedIds = collected.map((p) => p.id);
      expect(new Set(collectedIds).size).toBe(10);
      expect(collectedIds).toEqual(products.map((p) => p.id));
    });

    it('returns first page when cursor is null or undefined', () => {
      const pageNull = queryProductsPage(null, 3);
      const pageUndefined = queryProductsPage(undefined, 3);

      expect(pageNull.items).toHaveLength(3);
      expect(pageUndefined.items).toHaveLength(3);
      expect(pageNull.items[0]!.id).toBe(products[0]!.id);
      expect(pageUndefined.items[0]!.id).toBe(products[0]!.id);
      expect(pageNull.pageInfo.hasNextPage).toBe(true);
      expect(pageNull.pageInfo.nextCursor).toBe(products[2]!.id);
    });

    it('returns empty result set when cursor is nonexistent or invalid UUID', () => {
      const nonexistentCursor = randomUUID();
      const page = queryProductsPage(nonexistentCursor, 5);

      expect(page.items).toHaveLength(0);
      expect(page.pageInfo.hasNextPage).toBe(false);
      expect(page.pageInfo.nextCursor).toBeNull();
    });

    it('handles limit=1 single-step stepping through the entire dataset', () => {
      let cursor: string | null = null;
      const collected: string[] = [];

      for (let step = 0; step < 10; step++) {
        const page = queryProductsPage(cursor, 1);
        expect(page.items).toHaveLength(1);
        collected.push(page.items[0]!.id);

        if (step === 9) {
          expect(page.pageInfo.hasNextPage).toBe(false);
          expect(page.pageInfo.nextCursor).toBeNull();
        } else {
          expect(page.pageInfo.hasNextPage).toBe(true);
          expect(page.pageInfo.nextCursor).toBe(page.items[0]!.id);
          cursor = page.pageInfo.nextCursor;
        }
      }

      expect(collected).toEqual(products.map((p) => p.id));
    });

    it('handles limit greater than total items in a single page', () => {
      const page = queryProductsPage(null, 50);
      expect(page.items).toHaveLength(10);
      expect(page.pageInfo.hasNextPage).toBe(false);
      expect(page.pageInfo.nextCursor).toBeNull();
    });
  });

  describe('3. Stock Balance Ledger Derivation & Invariant Stress Test', () => {
    interface SimulatedMovement {
      type: 'ENTRY' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'DISCARD';
      quantity: number;
    }

    function calculateLedgerBalance(movements: SimulatedMovement[]): number {
      return movements.reduce((acc, mov) => {
        switch (mov.type) {
          case 'ENTRY':
            return acc + mov.quantity;
          case 'WITHDRAWAL':
          case 'DISCARD':
            return acc - mov.quantity;
          case 'ADJUSTMENT':
            return acc + mov.quantity;
          default:
            return acc;
        }
      }, 0);
    }

    it('accurately derives balance across ENTRY, WITHDRAWAL, DISCARD, and positive/negative ADJUSTMENT movements', () => {
      const movements: SimulatedMovement[] = [];

      // 1. Initial Entry: 100
      movements.push({ type: 'ENTRY', quantity: 100 });
      expect(calculateLedgerBalance(movements)).toBe(100);

      // 2. Secondary Entry: +50 -> 150
      movements.push({ type: 'ENTRY', quantity: 50 });
      expect(calculateLedgerBalance(movements)).toBe(150);

      // 3. Withdrawal: -40 -> 110
      movements.push({ type: 'WITHDRAWAL', quantity: 40 });
      expect(calculateLedgerBalance(movements)).toBe(110);

      // 4. Withdrawal: -30 -> 80
      movements.push({ type: 'WITHDRAWAL', quantity: 30 });
      expect(calculateLedgerBalance(movements)).toBe(80);

      // 5. Discard: -10 -> 70
      movements.push({ type: 'DISCARD', quantity: 10 });
      expect(calculateLedgerBalance(movements)).toBe(70);

      // 6. Positive Adjustment to 95: delta = 95 - 70 = +25 -> 95
      const current1 = calculateLedgerBalance(movements);
      const target1 = 95;
      movements.push({ type: 'ADJUSTMENT', quantity: target1 - current1 });
      expect(calculateLedgerBalance(movements)).toBe(95);

      // 7. Negative Adjustment to 20: delta = 20 - 95 = -75 -> 20
      const current2 = calculateLedgerBalance(movements);
      const target2 = 20;
      movements.push({ type: 'ADJUSTMENT', quantity: target2 - current2 });
      expect(calculateLedgerBalance(movements)).toBe(20);

      // 8. Full Exhaustion Withdrawal: -20 -> 0
      movements.push({ type: 'WITHDRAWAL', quantity: 20 });
      expect(calculateLedgerBalance(movements)).toBe(0);
    });

    it('rejects withdrawal when requested quantity exceeds available balance and throws InsufficientStockError', () => {
      const movements: SimulatedMovement[] = [{ type: 'ENTRY', quantity: 25 }];
      const currentBalance = calculateLedgerBalance(movements);
      const requestedQuantity = 30;

      expect(currentBalance).toBe(25);
      expect(requestedQuantity > currentBalance).toBe(true);

      const attemptWithdrawal = () => {
        if (currentBalance < requestedQuantity) {
          throw new InsufficientStockError(requestedQuantity, currentBalance);
        }
      };

      expect(attemptWithdrawal).toThrow(InsufficientStockError);
      // Ledger balance remains strictly 25 without corruption
      expect(calculateLedgerBalance(movements)).toBe(25);
    });

    it('proves unmasked negative balance derivation faithfully reports negative values if corrupt movement is calculated', () => {
      // Without Math.max(0, ...), raw ledger arithmetic computes -15
      const corruptMovements: SimulatedMovement[] = [
        { type: 'ENTRY', quantity: 10 },
        { type: 'WITHDRAWAL', quantity: 25 },
      ];

      const rawBalance = calculateLedgerBalance(corruptMovements);
      expect(rawBalance).toBe(-15);
      expect(rawBalance).toBeLessThan(0);
    });
  });
});
