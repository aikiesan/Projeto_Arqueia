import { describe, expect, it, vi } from 'vitest';

import { lookupAndResolveQr, parseQrCode, resolveQrDestination } from './qr-resolver';

const equipmentId = '8f555951-9dc0-41d1-b245-5ffdce74fad2';
const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const otherLaboratoryId = '9c666a62-9dc0-41d1-b245-5ffdce74fad4';
const timestamp = '2026-09-21T12:00:00.000Z';

/** Equipamento válido segundo `equipmentSchema` — o resolvedor valida o corpo. */
const equipmentFixture = {
  archivedAt: null,
  assetTag: null,
  benchOptionId: null,
  catalogOptionId: '1a222333-9dc0-41d1-b245-5ffdce74fad5',
  code: 'CP2B-EQP-01',
  createdAt: timestamp,
  id: equipmentId,
  laboratoryId,
  name: 'Cromatógrafo Líquido HPLC',
  notes: null,
  reservationPolicy: {
    absenceReleaseMinutes: 30,
    maxReservationMinutes: 240,
    requiresApproval: false,
    requiresTraining: false,
  },
  responsibleUserId: null,
  serialNumber: null,
  spaceOptionId: null,
  status: 'AVAILABLE',
  updatedAt: timestamp,
};

describe('qr-resolver', () => {
  describe('parseQrCode', () => {
    it('parses ARQ-LOT- prefixed codes as BATCH', () => {
      const parsed = parseQrCode('ARQ-LOT-44444444-4444-4444-a444-444444444444');
      expect(parsed.type).toBe('BATCH');
      expect(parsed.identifier).toBe('44444444-4444-4444-a444-444444444444');
      expect(parsed.actionHint).toBe('withdraw');
    });

    it('parses ARQ-CP2B-PRD- and LOT- batch codes as BATCH', () => {
      const parsed1 = parseQrCode('ARQ-CP2B-PRD-CITRATO-FE-01');
      expect(parsed1.type).toBe('BATCH');
      expect(parsed1.identifier).toBe('ARQ-CP2B-PRD-CITRATO-FE-01');

      const parsed2 = parseQrCode('LOT-2026-XYZ');
      expect(parsed2.type).toBe('BATCH');
      expect(parsed2.identifier).toBe('LOT-2026-XYZ');
    });

    it('parses ARQ-EQP- prefixed codes as EQUIPMENT', () => {
      const parsed = parseQrCode('ARQ-EQP-11111111-1111-4111-a111-111111111111');
      expect(parsed.type).toBe('EQUIPMENT');
      expect(parsed.identifier).toBe('11111111-1111-4111-a111-111111111111');
      expect(parsed.actionHint).toBe('reserve');
    });

    it('parses CP2B-EQP- and EQP- codes as EQUIPMENT', () => {
      const parsed1 = parseQrCode('CP2B-EQP-01');
      expect(parsed1.type).toBe('EQUIPMENT');
      expect(parsed1.identifier).toBe('CP2B-EQP-01');

      const parsed2 = parseQrCode('EQP-HPLC-02');
      expect(parsed2.type).toBe('EQUIPMENT');
      expect(parsed2.identifier).toBe('EQP-HPLC-02');
    });

    it('parses ARQ-SPC- and ARQ-LOC- codes as SPACE', () => {
      const parsed1 = parseQrCode('ARQ-SPC-SALA-LIMPA-01');
      expect(parsed1.type).toBe('SPACE');
      expect(parsed1.identifier).toBe('SALA-LIMPA-01');

      const parsed2 = parseQrCode('ARQ-LOC-BANCADA-03');
      expect(parsed2.type).toBe('SPACE');
      expect(parsed2.identifier).toBe('BANCADA-03');
    });

    it('parses complete Arqueia URLs correctly', () => {
      const batchUrl = parseQrCode('https://arqueia.cp2b.unicamp.br/estoque?batch=LOTE-2026-A');
      expect(batchUrl.type).toBe('BATCH');
      expect(batchUrl.identifier).toBe('LOTE-2026-A');

      const eqpUrl = parseQrCode('https://arqueia.cp2b.unicamp.br/agenda?equipmentId=eq-999');
      expect(eqpUrl.type).toBe('EQUIPMENT');
      expect(eqpUrl.identifier).toBe('eq-999');

      const qrUrl = parseQrCode('https://arqueia.cp2b.unicamp.br/qr?code=ARQ-LOT-XYZ-123');
      expect(qrUrl.type).toBe('BATCH');
      expect(qrUrl.identifier).toBe('XYZ-123');
    });

    it('handles empty and general unknown text gracefully', () => {
      const empty = parseQrCode('');
      expect(empty.type).toBe('UNKNOWN');
      expect(empty.identifier).toBe('');

      const general = parseQrCode('reagente especial');
      expect(general.type).toBe('UNKNOWN');
      expect(general.identifier).toBe('reagente especial');
    });
  });

  describe('resolveQrDestination', () => {
    it('constructs correct destination URL for BATCH with laboratory context', () => {
      const parsed = parseQrCode('ARQ-LOT-123');
      const url = resolveQrDestination(parsed, 'lab-cp2b');
      expect(url).toBe('/estoque?laboratory=lab-cp2b&batch=123&action=withdraw');
    });

    it('constructs correct destination URL for EQUIPMENT with laboratory context', () => {
      const parsed = parseQrCode('ARQ-EQP-456');
      const url = resolveQrDestination(parsed, 'lab-cp2b');
      expect(url).toBe('/agenda?laboratory=lab-cp2b&equipmentId=456');
    });

    it('constructs correct destination URL for SPACE with laboratory context', () => {
      const parsed = parseQrCode('ARQ-SPC-01');
      const url = resolveQrDestination(parsed, 'lab-cp2b');
      expect(url).toBe('/agenda?laboratory=lab-cp2b&space=01');
    });

    it('constructs search destination for UNKNOWN code', () => {
      const parsed = parseQrCode('termo de busca');
      const url = resolveQrDestination(parsed, 'lab-cp2b');
      expect(url).toBe('/estoque?laboratory=lab-cp2b&search=termo+de+busca');
    });
  });

  describe('lookupAndResolveQr', () => {
    it('looks up batch by QR endpoint and populates rich metadata', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/inventory/batches/by-qr/')) {
          return {
            json: async () => ({
              batchNumber: 'LOTE-2026-A',
              currentBalance: 50,
              expirationDate: '2027-12-31T00:00:00.000Z',
              id: 'b1',
              initialQuantity: 100,
              laboratoryId: 'lab-1',
              manufacturer: 'Sigma-Aldrich',
              qrCode: 'ARQ-LOT-b1',
            }),
            ok: true,
            status: 200,
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const result = await lookupAndResolveQr('ARQ-LOT-b1', 'lab-1', mockFetch as unknown as typeof fetch);

      expect(result.parsed.type).toBe('BATCH');
      expect(result.entity?.title).toBe('Lote LOTE-2026-A');
      expect(result.entity?.balance).toBe('50 / 100');
      expect(result.entity?.directActionLabel).toBe('Retirar Insumo');
      expect(result.entity?.directActionHref).toContain('action=withdraw');
    });

    it('resolve equipamento pelo endpoint do servidor, sem varrer páginas', async () => {
      const calls: string[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        calls.push(url);
        if (url.startsWith('/api/equipment/by-qr?')) {
          return { json: async () => equipmentFixture, ok: true, status: 200 } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const result = await lookupAndResolveQr(
        'CP2B-EQP-01',
        otherLaboratoryId,
        mockFetch as unknown as typeof fetch,
      );

      expect(result.parsed.type).toBe('EQUIPMENT');
      expect(result.entity?.title).toBe('Cromatógrafo Líquido HPLC');
      expect(result.entity?.status).toBe('AVAILABLE');
      expect(result.entity?.directActionLabel).toBe('Ver Agenda & Reservar');
      // O laboratório vem do equipamento resolvido, não do que estava aberto.
      expect(result.entity?.directActionHref).toBe(
        `/agenda?laboratory=${laboratoryId}&equipmentId=${equipmentId}`,
      );
      // Nenhuma varredura paginada de `/api/equipment?…`.
      expect(calls.some((url) => url.startsWith('/api/equipment?'))).toBe(false);
      expect(calls[0]).toBe(`/api/equipment/by-qr?code=${encodeURIComponent('CP2B-EQP-01')}`);
    });

    it('envia o código cru ao servidor, inclusive quando a etiqueta é uma URL', async () => {
      const calls: string[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        calls.push(url);
        if (url.startsWith('/api/equipment/by-qr?')) {
          return { json: async () => equipmentFixture, ok: true, status: 200 } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const label = `https://cp2b.unicamp.br/arqueia/qr?code=${encodeURIComponent(`ARQ-EQP-${equipmentId}`)}`;
      await lookupAndResolveQr(label, undefined, mockFetch as unknown as typeof fetch);

      expect(calls[0]).toBe(`/api/equipment/by-qr?code=${encodeURIComponent(label)}`);
    });

    it('não devolve entidade quando o servidor recusa a etiqueta', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);

      const result = await lookupAndResolveQr(
        `ARQ-EQP-${equipmentId}`,
        laboratoryId,
        mockFetch as unknown as typeof fetch,
      );

      expect(result.entity).toBeUndefined();
      expect(result.parsed.type).toBe('EQUIPMENT');
    });
  });
});
