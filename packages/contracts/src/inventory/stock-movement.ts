import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const stockMovementTypes = ['ENTRY', 'WITHDRAWAL', 'ADJUSTMENT', 'DISCARD'] as const;
export const stockMovementTypeSchema = z.enum(stockMovementTypes);

export const stockMovementFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  batchId: uuidSchema,
  productId: uuidSchema,
  userId: uuidSchema,
  projectId: uuidSchema.nullable().default(null),
  type: stockMovementTypeSchema,
  quantity: z.coerce.number(),
  balanceAfter: z.coerce.number().min(0),
  purpose: z.string().trim().max(500).nullable().default(null),
  reason: z.string().trim().max(1_000).nullable().default(null),
  performedAt: timestampSchema,
});

export const stockMovementSchema = entityMetadataSchema
  .extend(stockMovementFieldsSchema.shape)
  .strict();

export const withdrawStockInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    batchId: uuidSchema,
    projectId: uuidSchema,
    quantity: z.coerce.number().positive('A quantidade de retirada deve ser maior que zero.'),
    purpose: z.string().trim().min(2, 'Informe a finalidade do uso (mínimo 2 caracteres).').max(500),
    notes: z.string().trim().max(1_000).nullable().optional().default(null),
  })
  .strict();

export const adjustStockInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    batchId: uuidSchema,
    newBalance: z.coerce.number().min(0, 'O novo saldo não pode ser negativo.'),
    reason: z
      .string()
      .trim()
      .min(10, 'A justificativa de ajuste deve ter no mínimo 10 caracteres.')
      .max(1_000),
  })
  .strict();

export const listStockMovementsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    batchId: uuidSchema.optional(),
    productId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    type: stockMovementTypeSchema.optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const stockMovementPageSchema = createCursorPageSchema(stockMovementSchema).strict();

export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type WithdrawStockInput = z.input<typeof withdrawStockInputSchema>;
export type AdjustStockInput = z.input<typeof adjustStockInputSchema>;
export type ListStockMovementsQuery = z.input<typeof listStockMovementsQuerySchema>;
export type StockMovementPage = z.infer<typeof stockMovementPageSchema>;
