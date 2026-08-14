import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const batchStatuses = ['AVAILABLE', 'EXPIRED', 'EXHAUSTED', 'DISCARDED'] as const;
export const batchStatusSchema = z.enum(batchStatuses);

export const batchFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  productId: uuidSchema,
  batchNumber: z.string().trim().min(1).max(80),
  manufacturer: z.string().trim().max(160).nullable().default(null),
  expirationDate: timestampSchema.nullable().default(null),
  receivedDate: timestampSchema,
  spaceOptionId: uuidSchema.nullable().default(null),
  benchOptionId: uuidSchema.nullable().default(null),
  initialQuantity: z.coerce.number().positive(),
  currentBalance: z.coerce.number().min(0),
  qrCode: z.string().trim().min(1).max(120),
  status: batchStatusSchema,
  notes: z.string().trim().max(2_000).nullable().default(null),
});

export const batchSchema = entityMetadataSchema.extend(batchFieldsSchema.shape).strict();

export const createBatchInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    productId: uuidSchema,
    batchNumber: z.string().trim().min(1).max(80),
    manufacturer: z.string().trim().max(160).nullable().optional().default(null),
    expirationDate: timestampSchema.nullable().optional().default(null),
    receivedDate: timestampSchema.optional().default(() => new Date().toISOString()),
    spaceOptionId: uuidSchema.nullable().optional().default(null),
    benchOptionId: uuidSchema.nullable().optional().default(null),
    initialQuantity: z.coerce.number().positive(),
    notes: z.string().trim().max(2_000).nullable().optional().default(null),
  })
  .strict();

export const listBatchesQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    productId: uuidSchema.optional(),
    spaceOptionId: uuidSchema.optional(),
    status: batchStatusSchema.optional(),
    search: z.string().trim().min(1).max(80).optional(),
    expiringDays: z.coerce.number().int().positive().optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const batchParamsSchema = z.object({ batchId: uuidSchema }).strict();
export const batchPageSchema = createCursorPageSchema(batchSchema).strict();

export type BatchStatus = z.infer<typeof batchStatusSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type CreateBatchInput = z.input<typeof createBatchInputSchema>;
export type ListBatchesQuery = z.input<typeof listBatchesQuerySchema>;
export type BatchPage = z.infer<typeof batchPageSchema>;
