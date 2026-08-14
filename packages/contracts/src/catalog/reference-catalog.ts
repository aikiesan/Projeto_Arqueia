import { z } from 'zod';

import { entityMetadataSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

export const catalogOptionKinds = [
  'REAGENT',
  'MATERIAL',
  'EQUIPMENT_TYPE',
  'EQUIPMENT_MODEL',
  'SPACE',
  'BENCH',
  'FURNITURE',
  'PLANNING_ASSUMPTION',
] as const;

export const catalogOptionKindSchema = z.enum(catalogOptionKinds);

type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(4_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(100),
    z.record(z.string().min(1).max(80), jsonValueSchema),
  ]),
);

export const catalogOptionDetailsSchema = z
  .record(z.string().min(1).max(80), jsonValueSchema)
  .refine((details) => Object.keys(details).length <= 40, 'Detalhes excedem o limite permitido.');

export const catalogOptionSchema = entityMetadataSchema
  .extend({
    laboratoryId: uuidSchema,
    parentOptionId: uuidSchema.nullable(),
    kind: catalogOptionKindSchema,
    code: z.string().trim().min(1).max(96).nullable(),
    label: z.string().trim().min(1).max(500),
    category: z.string().trim().min(1).max(160).nullable(),
    description: z.string().trim().max(2_000).nullable(),
    details: catalogOptionDetailsSchema,
    isSelectable: z.boolean(),
    source: z
      .object({
        key: z.string().min(1).max(160),
        sheet: z.string().min(1).max(120),
        row: z.number().int().positive(),
        column: z.string().min(1).max(8).nullable(),
      })
      .strict(),
  })
  .strict();

export const listCatalogOptionsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    kind: catalogOptionKindSchema,
    search: z.string().trim().min(2).max(80).optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export const catalogOptionPageSchema = createCursorPageSchema(catalogOptionSchema).strict();

export type CatalogOptionKind = z.infer<typeof catalogOptionKindSchema>;
export type CatalogOptionDetails = z.infer<typeof catalogOptionDetailsSchema>;
export type CatalogOption = z.infer<typeof catalogOptionSchema>;
export type ListCatalogOptionsQuery = z.input<typeof listCatalogOptionsQuerySchema>;
export type CatalogOptionPage = z.infer<typeof catalogOptionPageSchema>;
