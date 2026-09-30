import { z } from 'zod';

import { entityMetadataSchema, timestampSchema, uuidSchema } from '../common/entity.js';
import { createCursorPageSchema } from '../common/pagination.js';

/**
 * Informes — canal de apoio para quem usa o laboratório avisar a coordenação.
 *
 * Quem envia é qualquer pessoa com a etiqueta QR em mãos, SEM login: o
 * formulário é público. Quem lê é só quem tem `field-report.review` no
 * laboratório (a coordenação). O contrato separa com rigor as duas fronteiras:
 *
 *   - `submitFieldReportInputSchema` é o que a internet aberta pode ENVIAR;
 *   - `publicFieldReportFormSchema` é o que a internet aberta pode LER para
 *     montar o formulário (laboratório e nome/código dos equipamentos, que a
 *     agenda pública já expõe);
 *   - `fieldReportSchema` é o informe completo, só para revisores.
 *
 * Um informe de uso de insumo NÃO é movimento de estoque (AGENTS.md §4.1): é um
 * aviso para que a coordenação registre a movimentação no livro-razão.
 */

export const fieldReportKinds = [
  'EQUIPMENT_PROBLEM',
  'MAINTENANCE_REQUEST',
  'SUPPLY_USAGE',
  'GENERAL_SUPPORT',
] as const;
export const fieldReportKindSchema = z.enum(fieldReportKinds);

export const fieldReportStatuses = ['NEW', 'IN_REVIEW', 'RESOLVED'] as const;
export const fieldReportStatusSchema = z.enum(fieldReportStatuses);

export const FIELD_REPORT_MESSAGE_MIN_LENGTH = 10;
export const FIELD_REPORT_MESSAGE_MAX_LENGTH = 2_000;
export const FIELD_REPORT_REVIEW_NOTE_MAX_LENGTH = 1_000;
/** Teto de equipamentos no formulário público: o suficiente para um laboratório. */
export const PUBLIC_FIELD_REPORT_EQUIPMENT_LIMIT = 500;

/** Prefixo do protocolo mostrado a quem enviou, para citar o informe depois. */
export const FIELD_REPORT_REFERENCE_PREFIX = 'INF-';

/** Protocolo legível derivado do id: curto para ditar, estável para buscar. */
export function fieldReportReference(fieldReportId: string): string {
  return `${FIELD_REPORT_REFERENCE_PREFIX}${fieldReportId.slice(0, 8).toUpperCase()}`;
}

/** Texto opcional: vazio vira null para que o banco não guarde strings vazias. */
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value));

export const submitFieldReportInputSchema = z
  .object({
    laboratoryId: uuidSchema,
    kind: fieldReportKindSchema,
    equipmentId: uuidSchema.nullable().optional().default(null),
    message: z
      .string()
      .trim()
      .min(FIELD_REPORT_MESSAGE_MIN_LENGTH, 'Descreva o informe com pelo menos 10 caracteres.')
      .max(FIELD_REPORT_MESSAGE_MAX_LENGTH),
    /** "Isso impede o uso agora?" — destaca o informe para a coordenação. */
    blocksUse: z.boolean().optional().default(false),
    /** Identificação é opcional: o canal existe para facilitar o aviso. */
    reporterName: optionalText(120),
    reporterContact: optionalText(160),
  })
  .strict();

export const submitFieldReportResultSchema = z
  .object({
    reference: z.string().regex(/^INF-[0-9A-F]{8}$/),
    receivedAt: timestampSchema,
  })
  .strict();

export const publicFieldReportEquipmentSchema = z
  .object({
    id: uuidSchema,
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(180),
  })
  .strict();

export const publicFieldReportFormQuerySchema = z.object({ laboratoryId: uuidSchema }).strict();

export const publicFieldReportFormSchema = z
  .object({
    laboratory: z
      .object({
        id: uuidSchema,
        code: z.string().trim().min(1).max(48),
        name: z.string().trim().min(1).max(200),
      })
      .strict(),
    equipment: z.array(publicFieldReportEquipmentSchema).max(PUBLIC_FIELD_REPORT_EQUIPMENT_LIMIT),
  })
  .strict();

export const fieldReportSchema = entityMetadataSchema
  .extend({
    laboratoryId: uuidSchema,
    reference: z.string().regex(/^INF-[0-9A-F]{8}$/),
    kind: fieldReportKindSchema,
    status: fieldReportStatusSchema,
    equipment: publicFieldReportEquipmentSchema.nullable(),
    message: z.string().min(1).max(FIELD_REPORT_MESSAGE_MAX_LENGTH),
    blocksUse: z.boolean(),
    reporterName: z.string().max(120).nullable(),
    reporterContact: z.string().max(160).nullable(),
    reviewNote: z.string().max(FIELD_REPORT_REVIEW_NOTE_MAX_LENGTH).nullable(),
    reviewedBy: z.object({ id: uuidSchema, name: z.string().min(1) }).strict().nullable(),
    reviewedAt: timestampSchema.nullable(),
  })
  .strict();

export const fieldReportPageSchema = createCursorPageSchema(fieldReportSchema);

export const listFieldReportsQuerySchema = z
  .object({
    laboratoryId: uuidSchema,
    kind: fieldReportKindSchema.optional(),
    status: fieldReportStatusSchema.optional(),
    cursor: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export const fieldReportSummaryQuerySchema = z.object({ laboratoryId: uuidSchema }).strict();

const countSchema = z.number().int().min(0);

/** O "compilado": quanto há em aberto por tipo e em que pé está a triagem. */
export const fieldReportSummarySchema = z
  .object({
    laboratoryId: uuidSchema,
    openByKind: z
      .object({
        EQUIPMENT_PROBLEM: countSchema,
        MAINTENANCE_REQUEST: countSchema,
        SUPPLY_USAGE: countSchema,
        GENERAL_SUPPORT: countSchema,
      })
      .strict(),
    byStatus: z
      .object({ NEW: countSchema, IN_REVIEW: countSchema, RESOLVED: countSchema })
      .strict(),
    openBlockingUse: countSchema,
  })
  .strict();

export const fieldReportParamsSchema = z.object({ fieldReportId: uuidSchema }).strict();

export const reviewFieldReportInputSchema = z
  .object({
    status: fieldReportStatusSchema,
    reviewNote: z
      .string()
      .trim()
      .max(FIELD_REPORT_REVIEW_NOTE_MAX_LENGTH)
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .strict();

export type FieldReportKind = z.infer<typeof fieldReportKindSchema>;
export type FieldReportStatus = z.infer<typeof fieldReportStatusSchema>;
export type SubmitFieldReportInput = z.input<typeof submitFieldReportInputSchema>;
export type ParsedSubmitFieldReportInput = z.output<typeof submitFieldReportInputSchema>;
export type SubmitFieldReportResult = z.infer<typeof submitFieldReportResultSchema>;
export type PublicFieldReportEquipment = z.infer<typeof publicFieldReportEquipmentSchema>;
export type PublicFieldReportForm = z.infer<typeof publicFieldReportFormSchema>;
export type FieldReport = z.infer<typeof fieldReportSchema>;
export type FieldReportPage = z.infer<typeof fieldReportPageSchema>;
export type ListFieldReportsQuery = z.output<typeof listFieldReportsQuerySchema>;
export type FieldReportSummary = z.infer<typeof fieldReportSummarySchema>;
export type ReviewFieldReportInput = z.input<typeof reviewFieldReportInputSchema>;
export type ParsedReviewFieldReportInput = z.output<typeof reviewFieldReportInputSchema>;
