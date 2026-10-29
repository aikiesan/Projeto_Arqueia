import type { FieldReportKind } from '@arqueia/contracts';

import type { UrgencyReason } from '../field-report-urgency.js';

export interface FieldReportAlertRecipient {
  readonly name: string;
  readonly email: string;
}

/**
 * Quem é avisado de um informe urgente: quem pode revisar informes naquele
 * laboratório. É a mesma regra que já decide quem lê os informes, então a
 * lista se corrige sozinha quando alguém entra ou sai da equipe — não há
 * endereço escrito no código nem no `.env` para alguém esquecer de atualizar.
 */
export interface FieldReportAlertRecipientReader {
  listForLaboratory(laboratoryId: string): Promise<readonly FieldReportAlertRecipient[]>;
}

export interface UrgentFieldReportAlert {
  readonly reference: string;
  readonly kind: FieldReportKind;
  readonly message: string;
  readonly blocksUse: boolean;
  readonly reporterName: string | null;
  readonly reporterContact: string | null;
  readonly reasons: readonly UrgencyReason[];
  readonly submittedAt: string;
  readonly reviewUrl: string;
  readonly recipients: readonly FieldReportAlertRecipient[];
}

export interface UrgentFieldReportNotifier {
  /** 'log' quando não há SMTP configurado — ver `MailSender`. */
  readonly channel: 'smtp' | 'log';
  notify(alert: UrgentFieldReportAlert): Promise<void>;
}

export const FIELD_REPORT_ALERT_RECIPIENT_READER = Symbol(
  'FIELD_REPORT_ALERT_RECIPIENT_READER',
);
export const URGENT_FIELD_REPORT_NOTIFIER = Symbol('URGENT_FIELD_REPORT_NOTIFIER');
