import { z } from 'zod';

import { unitOfMeasureSchema } from '../inventory/product.js';
import { uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const managementAnalyticsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
    {
      message: 'A data final deve ser estritamente posterior à data inicial (intervalo semiaberto).',
      path: ['endsAt'],
    },
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime();
      const maxMs = 90 * 24 * 60 * 60 * 1000; // 90 dias
      return diffMs <= maxMs;
    },
    {
      message: 'O período do relatório não pode exceder 90 dias.',
      path: ['endsAt'],
    },
  );

export const consumedProductSummarySchema = z
  .object({
    productId: uuidSchema,
    productCode: z.string(),
    productName: z.string(),
    unitOfMeasure: unitOfMeasureSchema,
    totalQuantity: z.number().nonnegative(),
  })
  .strict();

export const projectUsageSummarySchema = z
  .object({
    projectId: uuidSchema.nullable(),
    projectCode: z.string().nullable(),
    projectName: z.string(),
    reservedHours: z.number().nonnegative(),
    reservationCount: z.number().int().nonnegative(),
    withdrawalCount: z.number().int().nonnegative(),
    consumedProducts: z.array(consumedProductSummarySchema).max(50),
  })
  .strict();

export const projectUsageQuerySchema = managementAnalyticsQuerySchema
  .extend({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const projectUsagePageSchema = createCursorPageSchema(projectUsageSummarySchema).strict();

export const managementAnalyticsSchema = z
  .object({
    laboratoryId: uuidSchema,
    timezone: z.string(),
    period: z
      .object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .strict(),
    equipmentMetrics: z
      .object({
        totalActiveEquipment: z.number().int().nonnegative(),
        totalReservedHours: z.number().nonnegative(),
        reservationCount: z.number().int().nonnegative(),
      })
      .strict(),
    inventoryMetrics: z
      .object({
        totalActiveBatches: z.number().int().nonnegative(),
        lowStockProductsCount: z.number().int().nonnegative(),
        expiringBatchesCount: z.number().int().nonnegative(),
        totalWithdrawalsCount: z.number().int().nonnegative(),
      })
      .strict(),
    generatedAt: z.string().datetime(),
  })
  .strict();

export type ManagementAnalyticsQuery = z.input<typeof managementAnalyticsQuerySchema>;
export type ConsumedProductSummary = z.infer<typeof consumedProductSummarySchema>;
export type ProjectUsageSummary = z.infer<typeof projectUsageSummarySchema>;
export type ProjectUsageQuery = z.input<typeof projectUsageQuerySchema>;
export type ProjectUsagePage = z.infer<typeof projectUsagePageSchema>;
export type ManagementAnalytics = z.infer<typeof managementAnalyticsSchema>;
