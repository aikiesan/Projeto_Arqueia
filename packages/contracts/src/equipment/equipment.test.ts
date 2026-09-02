import { describe, expect, it } from 'vitest';

import {
  createEquipmentInputSchema,
  listEquipmentQuerySchema,
  reservationPolicySchema,
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

  it('validates reservation policy boundaries (min 30 min, max 10080 min, absence 0-240 min)', () => {
    // Valid boundary values
    const minPolicy = reservationPolicySchema.parse({
      maxReservationMinutes: 30,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 0,
    });
    expect(minPolicy.maxReservationMinutes).toBe(30);
    expect(minPolicy.absenceReleaseMinutes).toBe(0);

    const maxPolicy = reservationPolicySchema.parse({
      maxReservationMinutes: 10_080,
      requiresTraining: true,
      requiresApproval: true,
      absenceReleaseMinutes: 240,
    });
    expect(maxPolicy.maxReservationMinutes).toBe(10_080);
    expect(maxPolicy.absenceReleaseMinutes).toBe(240);

    // Invalid < 30 min
    expect(() =>
      reservationPolicySchema.parse({
        maxReservationMinutes: 29,
        requiresTraining: false,
        requiresApproval: false,
        absenceReleaseMinutes: 30,
      }),
    ).toThrow();

    // Invalid > 10080 min (7 days)
    expect(() =>
      reservationPolicySchema.parse({
        maxReservationMinutes: 10_081,
        requiresTraining: false,
        requiresApproval: false,
        absenceReleaseMinutes: 30,
      }),
    ).toThrow();

    // Invalid absence release > 240 min
    expect(() =>
      reservationPolicySchema.parse({
        maxReservationMinutes: 60,
        requiresTraining: false,
        requiresApproval: false,
        absenceReleaseMinutes: 241,
      }),
    ).toThrow();
  });

  it('rejects invalid code patterns and characters', () => {
    expect(() =>
      createEquipmentInputSchema.parse({
        laboratoryId,
        catalogOptionId: optionId,
        code: '-INVALID-START',
        name: 'Equipamento',
      }),
    ).toThrow();

    expect(() =>
      createEquipmentInputSchema.parse({
        laboratoryId,
        catalogOptionId: optionId,
        code: 'EQ@SPECIAL#CHAR',
        name: 'Equipamento',
      }),
    ).toThrow();
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
