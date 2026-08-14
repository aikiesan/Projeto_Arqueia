import { z } from 'zod';

export const cursorPageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const cursorPageInfoSchema = z.object({
  nextCursor: z.string().min(1).nullable(),
  hasNextPage: z.boolean(),
});

export type CursorPageQuery = z.input<typeof cursorPageQuerySchema>;
export type CursorPageInfo = z.infer<typeof cursorPageInfoSchema>;

export function createCursorPageSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: cursorPageInfoSchema,
  });
}
