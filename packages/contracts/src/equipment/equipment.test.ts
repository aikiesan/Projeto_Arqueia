import { describe, expect, it } from 'vitest';

import {
  createEquipmentInputSchema,
  listEquipmentQuerySchema,
  updateEquipmentInputSchema,
} from './equipment.js';

const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const optionId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('equipment contract', () => {
  it('creates a safe default reservation policy and canonical CP2b code', () => {
    const parsed = createEquipmentInputSchema.parse({
      laboratoryId,
      catalogOptionId: optionId,
      code: 'cp2b-hplc-01',
      name: 'HPLC principal',
    });

    expect(parsed.code).toBe('CP2b-HPLC-01');
    expect(parsed.reservationPolicy).toEqual({
      maxReservationMinutes: 720,
      requiresTraining: true,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    });
  });

  it('requires laboratory scope and bounds listing input', () => {
    expect(() => listEquipmentQuerySchema.parse({ limit: 25 })).toThrow();
    expect(() =>
      listEquipmentQuerySchema.parse({ laboratoryId, search: "'; DROP TABLE equipment; --" }),
    ).not.toThrow();
    expect(() => listEquipmentQuerySchema.parse({ laboratoryId, limit: 500 })).toThrow();
  });

  it('rejects empty updates and unknown fields', () => {
    expect(() => updateEquipmentInputSchema.parse({})).toThrow();
    expect(() => updateEquipmentInputSchema.parse({ code: 'EQ-1', sql: 'DROP' })).toThrow();
  });
});
