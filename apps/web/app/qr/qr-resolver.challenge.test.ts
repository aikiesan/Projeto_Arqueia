import { describe, expect, it, vi } from 'vitest';

import { lookupAndResolveQr, parseQrCode, resolveQrDestination } from './qr-resolver';

const challengeEquipmentId = 'aa111111-1111-4111-a111-111111111111';
const challengeLaboratoryId = 'bb222222-2222-4222-a222-222222222222';

/** Corpo que o endpoint devolve — validado contra `equipmentSchema`. */
const challengeEquipment = {
  archivedAt: null,
  assetTag: null,
  benchOptionId: null,
  catalogOptionId: 'cc333333-3333-4333-a333-333333333333',
  code: 'CP2B-EQP-99',
  createdAt: '2026-09-21T12:00:00.000Z',
  id: challengeEquipmentId,
  laboratoryId: challengeLaboratoryId,
  name: 'Espectrômetro de Massa',
  notes: null,
  reservationPolicy: {
    absenceReleaseMinutes: 30,
    maxReservationMinutes: 240,
    requiresApproval: false,
    requiresTraining: false,
  },
  responsibleUserId: null,
  serialNumber: 'SN-998877',
  spaceOptionId: null,
  status: 'AVAILABLE',
  updatedAt: '2026-09-21T12:00:00.000Z',
};

describe('QR Resolver — Adversarial & Stress Challenge Suite', () => {
  describe('parseQrCode — Malformed, Edge Case, and Adversarial Inputs', () => {
    it('handles empty strings and whitespace-only inputs without crashing', () => {
      const inputs = ['', '   ', '\t', '\n', '\r\n', '  \t  \n  '];
      for (const input of inputs) {
        const parsed = parseQrCode(input);
        expect(parsed).toEqual({
          actionHint: 'view',
          identifier: '',
          raw: '',
          type: 'UNKNOWN',
        });
      }
    });

    it('gracefully handles malformed URLs without throwing URL parser errors', () => {
      const malformedUrls = [
        'http://',
        'https://',
        'http://[invalid-ipv6-bracket',
        'https://:8080/path',
        'http:///estoque?batch=123',
      ];

      for (const malformed of malformedUrls) {
        expect(() => parseQrCode(malformed)).not.toThrow();
        const parsed = parseQrCode(malformed);
        expect(parsed).toBeDefined();
        expect(parsed.raw).toBe(malformed.trim());
      }
    });

    it('extracts batch and equipment identifiers from complex URLs with extra query params, fragments, and ports', () => {
      // Complex Batch URL
      const complexBatchUrl =
        'https://app.arqueia.local:8080/estoque?unrelated=123&laboratory=lab-cp2b&batch=LOT-2026-X99&view=table#details';
      const parsedBatch = parseQrCode(complexBatchUrl);
      expect(parsedBatch.type).toBe('BATCH');
      expect(parsedBatch.identifier).toBe('LOT-2026-X99');
      expect(parsedBatch.actionHint).toBe('withdraw');
      expect(parsedBatch.originalUrl).toBe(complexBatchUrl);

      // Batch URL using batchId alias
      const batchIdUrl = 'https://app.arqueia.local/estoque?batchId=44444444-4444-4444-a444-444444444444';
      const parsedBatchId = parseQrCode(batchIdUrl);
      expect(parsedBatchId.type).toBe('BATCH');
      expect(parsedBatchId.identifier).toBe('44444444-4444-4444-a444-444444444444');

      // Complex Equipment URL
      const complexEqpUrl =
        'http://localhost:3000/agenda?date=2026-08-24&equipmentId=eq-hplc-99&tab=day#timeline';
      const parsedEqp = parseQrCode(complexEqpUrl);
      expect(parsedEqp.type).toBe('EQUIPMENT');
      expect(parsedEqp.identifier).toBe('eq-hplc-99');
      expect(parsedEqp.actionHint).toBe('reserve');

      // Equipment URL using equipment alias
      const eqpAliasUrl = 'https://arqueia.unicamp.br/agenda?equipment=CP2B-EQP-05';
      const parsedEqpAlias = parseQrCode(eqpAliasUrl);
      expect(parsedEqpAlias.type).toBe('EQUIPMENT');
      expect(parsedEqpAlias.identifier).toBe('CP2B-EQP-05');
    });

    it('resolves nested /qr?code= URLs and recursively decodes target entities', () => {
      const nestedBatchUrl = 'https://arqueia.unicamp.br/qr?code=ARQ-LOT-55555555-5555-4555-a555-555555555555';
      const parsed = parseQrCode(nestedBatchUrl);
      expect(parsed.type).toBe('BATCH');
      expect(parsed.identifier).toBe('55555555-5555-4555-a555-555555555555');
      expect(parsed.actionHint).toBe('withdraw');
      expect(parsed.originalUrl).toBe(nestedBatchUrl);

      const nestedEqpUrl = 'https://arqueia.unicamp.br/qr?code=ARQ-EQP-HPLC-01';
      const parsedEqp = parseQrCode(nestedEqpUrl);
      expect(parsedEqp.type).toBe('EQUIPMENT');
      expect(parsedEqp.identifier).toBe('HPLC-01');
      expect(parsedEqp.actionHint).toBe('reserve');
    });

    it('classifies raw UUIDs and non-prefixed codes as UNKNOWN initially for subsequent API lookup', () => {
      const rawUuid = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
      const parsed = parseQrCode(rawUuid);
      expect(parsed.type).toBe('UNKNOWN');
      expect(parsed.identifier).toBe(rawUuid);
      expect(parsed.raw).toBe(rawUuid);
      expect(parsed.actionHint).toBe('view');
    });

    it('is case-insensitive for standard prefixes', () => {
      expect(parseQrCode('arq-lot-12345').type).toBe('BATCH');
      expect(parseQrCode('arq-lot-12345').identifier).toBe('12345');

      expect(parseQrCode('Arq-EqP-999').type).toBe('EQUIPMENT');
      expect(parseQrCode('Arq-EqP-999').identifier).toBe('999');

      expect(parseQrCode('arq-spc-sala-b').type).toBe('SPACE');
      expect(parseQrCode('arq-spc-sala-b').identifier).toBe('sala-b');

      expect(parseQrCode('arq-cp2b-prd-citrato').type).toBe('BATCH');
      expect(parseQrCode('cp2b-eqp-02').type).toBe('EQUIPMENT');
    });

    it('treats empty prefix suffixes as UNKNOWN rather than capturing empty identifier', () => {
      // ARQ-LOT- with nothing after should not be treated as a valid batch id ""
      const emptyLot = parseQrCode('ARQ-LOT-');
      expect(emptyLot.type).toBe('UNKNOWN');
      expect(emptyLot.identifier).toBe('ARQ-LOT-');

      const emptyEqp = parseQrCode('ARQ-EQP-');
      expect(emptyEqp.type).toBe('UNKNOWN');
      expect(emptyEqp.identifier).toBe('ARQ-EQP-');

      const emptySpc = parseQrCode('ARQ-SPC-');
      expect(emptySpc.type).toBe('UNKNOWN');
      expect(emptySpc.identifier).toBe('ARQ-SPC-');
    });

    it('handles potential injection / special character payloads safely', () => {
      const payloads = [
        "ARQ-LOT-'; DROP TABLE batches; --",
        'ARQ-LOT-<script>alert("xss")</script>',
        'ARQ-EQP-../../../../etc/passwd',
        'ARQ-LOT-[malformed-structure]',
        'ARQ-LOT-%00%0D%0A',
      ];

      for (const payload of payloads) {
        const parsed = parseQrCode(payload);
        expect(parsed.raw).toBe(payload);
        // Suffix is extracted as literal string without breaking
        expect(parsed.identifier.length).toBeGreaterThan(0);
      }
    });
  });

  describe('resolveQrDestination — Destination URL Construction', () => {
    it('constructs encoded search destination when parsed type is UNKNOWN', () => {
      const parsed = parseQrCode('reagente & solvente = ácido');
      const dest = resolveQrDestination(parsed, 'lab-cp2b');
      expect(dest).toBe('/estoque?laboratory=lab-cp2b&search=reagente+%26+solvente+%3D+%C3%A1cido');
    });

    it('constructs destination without search parameter if identifier is empty', () => {
      const parsed = parseQrCode('');
      const dest = resolveQrDestination(parsed, 'lab-cp2b');
      expect(dest).toBe('/estoque?laboratory=lab-cp2b');
    });

    it('constructs destination when laboratoryId is omitted', () => {
      const parsedBatch = parseQrCode('ARQ-LOT-b-999');
      expect(resolveQrDestination(parsedBatch)).toBe('/estoque?batch=b-999&action=withdraw');

      const parsedEqp = parseQrCode('ARQ-EQP-e-999');
      expect(resolveQrDestination(parsedEqp)).toBe('/agenda?equipmentId=e-999');
    });
  });

  describe('lookupAndResolveQr — API Lookup & Fault Tolerance', () => {
    it('handles network failure (fetch rejection) gracefully without throwing', async () => {
      const failingFetch = vi.fn().mockRejectedValue(new Error('Network error / offline'));

      const result = await lookupAndResolveQr('ARQ-LOT-b-100', 'lab-1', failingFetch as unknown as typeof fetch);

      expect(result).toBeDefined();
      expect(result.parsed.type).toBe('BATCH');
      expect(result.parsed.identifier).toBe('b-100');
      expect(result.destinationUrl).toBe('/estoque?laboratory=lab-1&batch=b-100&action=withdraw');
      expect(result.entity).toBeUndefined();
    });

    it('handles API returning non-200 or 500 error gracefully', async () => {
      const errorFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      } as Response);

      const result = await lookupAndResolveQr('CP2B-EQP-01', 'lab-1', errorFetch as unknown as typeof fetch);

      expect(result).toBeDefined();
      expect(result.parsed.type).toBe('EQUIPMENT');
      expect(result.destinationUrl).toBe('/agenda?laboratory=lab-1&equipmentId=CP2B-EQP-01');
      expect(result.entity).toBeUndefined();
    });

    it('resolves raw UUID by searching batches first, then upgrading parsed type to BATCH', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/inventory/batches/by-qr/')) {
          return { ok: false, status: 404 } as Response;
        }
        if (url.includes('/api/inventory/batches?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
                  laboratoryId: 'lab-cp2b',
                  batchNumber: 'LOTE-RAW-UUID-01',
                  qrCode: 'ARQ-CP2B-PRD-01',
                  currentBalance: 0,
                  initialQuantity: 100,
                  expirationDate: null,
                  manufacturer: null,
                },
              ],
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const rawUuid = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
      const result = await lookupAndResolveQr(rawUuid, 'lab-cp2b', mockFetch as unknown as typeof fetch);

      expect(result.parsed.type).toBe('BATCH');
      expect(result.parsed.identifier).toBe(rawUuid);
      expect(result.entity).toBeDefined();
      expect(result.entity?.title).toBe('Lote LOTE-RAW-UUID-01');
      expect(result.entity?.status).toBe('Esgotado'); // currentBalance = 0
      expect(result.entity?.balance).toBe('0 / 100');
      expect(result.destinationUrl).toBe(
        `/estoque?laboratory=lab-cp2b&batch=${rawUuid}&action=withdraw`,
      );
    });

    it('resolves raw UUID by searching equipment when not in batches, upgrading parsed type to EQUIPMENT', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/inventory/batches/by-qr/')) {
          return { ok: false, status: 404 } as Response;
        }
        if (url.includes('/api/inventory/batches?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [] }),
          } as Response;
        }
        if (url.startsWith('/api/equipment/by-qr?')) {
          return {
            ok: true,
            status: 200,
            json: async () => challengeEquipment,
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const result = await lookupAndResolveQr(
        challengeEquipmentId,
        'lab-cp2b',
        mockFetch as unknown as typeof fetch,
      );

      // O identificador cru não casa com prefixo de etiqueta e chega UNKNOWN;
      // quem confirma que é equipamento é o servidor, ao resolvê-lo.
      expect(result.parsed.type).toBe('EQUIPMENT');
      expect(result.parsed.identifier).toBe(challengeEquipmentId);
      expect(result.entity).toBeDefined();
      expect(result.entity?.title).toBe('Espectrômetro de Massa');
      expect(result.entity?.subtitle).toBe('CP2b-EQP-99'); // canonicalizado pelo contrato
      expect(result.entity?.status).toBe('AVAILABLE');
      expect(result.destinationUrl).toBe(
        `/agenda?laboratory=${challengeLaboratoryId}&equipmentId=${challengeEquipmentId}`,
      );
    });
  });
});
