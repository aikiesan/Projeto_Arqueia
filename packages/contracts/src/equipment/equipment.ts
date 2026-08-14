import { z } from 'zod';

import { canonicalizeArqueiaCode } from '../common/canonical-code.js';
import { entityMetadataSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const equipmentStatuses = [
  'AVAILABLE',
  'UNDER_EVALUATION',
  'UNAVAILABLE',
  'MAINTENANCE',
] as const;

export const equipmentStatusSchema = z.enum(equipmentStatuses);

export const reservationPolicySchema = z
  .object({
    maxReservationMinutes: z.coerce.number().int().min(30).max(10_080),
    requiresTraining: z.boolean(),
    requiresApproval: z.boolean(),
    absenceReleaseMinutes: z.coerce.number().int().min(0).max(240),
  })
  .strict();

const nullableTrimmed = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();

const equipmentFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  catalogOptionId: uuidSchema,
  spaceOptionId: uuidSchema.nullable(),
  benchOptionId: uuidSchema.nullable(),
  responsibleUserId: uuidSchema.nullable(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/)
    .transform(canonicalizeArqueiaCode),
  name: z.string().trim().min(2).max(180),
  assetTag: nullableTrimmed(96),
  serialNumber: nullableTrimmed(160),
  status: equipmentStatusSchema,
  reservationPolicy: reservationPolicySchema,
  notes: z.string().trim().max(2_000).nullable(),
});

export const equipmentSchema = entityMetadataSchema.extend(equipmentFieldsSchema.shape).strict();

export const createEquipmentInputSchema = equipmentFieldsSchema
  .omit({ status: true })
  .extend({
    spaceOptionId: uuidSchema.nullable().optional().default(null),
    benchOptionId: uuidSchema.nullable().optional().default(null),
    responsibleUserId: uuidSchema.nullable().optional().default(null),
    assetTag: nullableTrimmed(96).optional().default(null),
    serialNumber: nullableTrimmed(160).optional().default(null),
    reservationPolicy: reservationPolicySchema.optional().default({
      maxReservationMinutes: 720,
      requiresTraining: true,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    }),
    notes: z.string().trim().max(2_000).nullable().optional().default(null),
  })
  .strict();

export const updateEquipmentInputSchema = equipmentFieldsSchema
  .omit({ laboratoryId: true })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Informe ao menos um campo para atualizar.');

export const listEquipmentQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    status: equipmentStatusSchema.optional(),
    search: z.string().trim().min(2).max(80).optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export const equipmentParamsSchema = z.object({ equipmentId: uuidSchema }).strict();
export const equipmentPageSchema = createCursorPageSchema(equipmentSchema).strict();

export type Equipment = z.infer<typeof equipmentSchema>;
export type EquipmentStatus = z.infer<typeof equipmentStatusSchema>;
export type ReservationPolicy = z.infer<typeof reservationPolicySchema>;
export type CreateEquipmentInput = z.input<typeof createEquipmentInputSchema>;
export type UpdateEquipmentInput = z.input<typeof updateEquipmentInputSchema>;
export type ListEquipmentQuery = z.input<typeof listEquipmentQuerySchema>;
export type EquipmentPage = z.infer<typeof equipmentPageSchema>;
