import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const productCategories = [
  'REAGENT',
  'SOLVENT',
  'CONSUMABLE',
  'GLASSWARE',
  'STANDARD',
  'OTHER',
] as const;
export const productCategorySchema = z.enum(productCategories);

export const unitOfMeasures = [
  'ML',
  'L',
  'G',
  'KG',
  'UNIDADE',
  'CAIXA',
  'FRASCO',
  'PACOTE',
] as const;
export const unitOfMeasureSchema = z.enum(unitOfMeasures);

export const productFieldsSchema = z.object({
  laboratoryId: uuidSchema,
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(180),
  casNumber: z.string().trim().max(32).nullable().default(null),
  category: productCategorySchema,
  unitOfMeasure: unitOfMeasureSchema,
  minimumStockThreshold: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(2_000).nullable().default(null),
});

export const productSchema = entityMetadataSchema.extend(productFieldsSchema.shape).strict();

export const createProductInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    code: z.string().trim().min(2).max(64),
    name: z.string().trim().min(2).max(180),
    casNumber: z.string().trim().max(32).nullable().optional().default(null),
    category: productCategorySchema,
    unitOfMeasure: unitOfMeasureSchema,
    minimumStockThreshold: z.coerce.number().min(0).optional().default(0),
    description: z.string().trim().max(2_000).nullable().optional().default(null),
  })
  .strict();

export const updateProductInputSchema = productFieldsSchema
  .omit({ laboratoryId: true, code: true })
  .partial()
  .strict();

export const listProductsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    category: productCategorySchema.optional(),
    search: z.string().trim().min(1).max(80).optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const productParamsSchema = z.object({ productId: uuidSchema }).strict();
export const productPageSchema = createCursorPageSchema(productSchema).strict();

export type ProductCategory = z.infer<typeof productCategorySchema>;
export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;
export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.input<typeof createProductInputSchema>;
export type UpdateProductInput = z.input<typeof updateProductInputSchema>;
export type ListProductsQuery = z.input<typeof listProductsQuerySchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
