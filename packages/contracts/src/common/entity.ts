import { z } from 'zod';

export { canonicalizeArqueiaCode } from './canonical-code.js';

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });

export const entityMetadataSchema = z.object({
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.nullable(),
});

export type EntityMetadata = z.infer<typeof entityMetadataSchema>;
