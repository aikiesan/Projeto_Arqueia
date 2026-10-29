import type { FieldReportKind } from '@arqueia/contracts';

import type { MailSender } from '../../../shared/infrastructure/mailer.module.js';
import type {
  UrgentFieldReportAlert,
  UrgentFieldReportNotifier,
} from '../domain/ports/urgent-field-report-alert.port.js';

/**
 * Rótulos do e-mail. Não compartilhados com os da interface de propósito: ali
 * eles acompanham descrição e placeholder do formulário, que é apresentação; a
 * linha de assunto quer só o nome curto do tipo.
 */
const KIND_LABEL: Readonly<Record<FieldReportKind, string>> = {
  EQUIPMENT_PROBLEM: 'Problema em equipamento',
  MAINTENANCE_REQUEST: 'Necessidade de manutenção',
  SUPPLY_USAGE: 'Uso de insumo ou reagente',
  GENERAL_SUPPORT: 'Informe geral',
};

const REASON_LABEL: Readonly<Record<string, string>> = {
  blocks_use: 'quem enviou marcou que o equipamento não pode ser usado',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function describeReasons(reasons: readonly string[]): readonly string[] {
  const keywords = reasons
    .filter((reason) => reason.startsWith('keyword:'))
    .map((reason) => reason.slice('keyword:'.length));

  return [
    ...reasons.filter((reason) => reason in REASON_LABEL).map((reason) => REASON_LABEL[reason]!),
    ...(keywords.length === 0
      ? []
      : [`a mensagem contém ${keywords.map((word) => `"${word}"`).join(', ')}`]),
  ];
}

export function formatSubmittedAt(submittedAt: string): string {
  return new Date(submittedAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export function urgentFieldReportEmailBody(alert: UrgentFieldReportAlert): {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
} {
  const reasons = describeReasons(alert.reasons);
  const quem =
    alert.reporterName === null && alert.reporterContact === null
      ? 'Não se identificou.'
      : [alert.reporterName, alert.reporterContact].filter(Boolean).join(' — ');

  const subject = `Arqueia — informe urgente ${alert.reference}${
    alert.blocksUse ? ' (equipamento parado)' : ''
  }`;

  const text = [
    `Um informe entrou marcado como urgente em ${formatSubmittedAt(alert.submittedAt)}.`,
    '',
    `Protocolo: ${alert.reference}`,
    `Tipo: ${KIND_LABEL[alert.kind]}`,
    `Por que alertamos: ${reasons.join('; ')}.`,
    `Quem enviou: ${quem}`,
    '',
    'Mensagem:',
    alert.message,
    '',
    `Abrir na triagem: ${alert.reviewUrl}`,
    '',
    'Esta mensagem é automática. Quem enviou o informe não recebe cópia dela.',
    'Arqueia — CP2b/Unicamp',
  ].join('\n');

  const html = [
    `<p>Um informe entrou marcado como <strong>urgente</strong> em ${escapeHtml(formatSubmittedAt(alert.submittedAt))}.</p>`,
    '<ul>',
    `<li><strong>Protocolo:</strong> ${escapeHtml(alert.reference)}</li>`,
    `<li><strong>Tipo:</strong> ${escapeHtml(KIND_LABEL[alert.kind])}</li>`,
    `<li><strong>Por que alertamos:</strong> ${escapeHtml(reasons.join('; '))}</li>`,
    `<li><strong>Quem enviou:</strong> ${escapeHtml(quem)}</li>`,
    '</ul>',
    `<p><strong>Mensagem:</strong></p><blockquote>${escapeHtml(alert.message)}</blockquote>`,
    `<p><a href="${escapeHtml(alert.reviewUrl)}">Abrir na triagem</a></p>`,
    '<p>Esta mensagem é automática. Quem enviou o informe não recebe cópia dela.</p>',
    '<p>Arqueia — CP2b/Unicamp</p>',
  ].join('\n');

  return { subject, text, html };
}

export class MailUrgentFieldReportNotifier implements UrgentFieldReportNotifier {
  public constructor(private readonly mail: MailSender) {}

  public get channel(): 'smtp' | 'log' {
    return this.mail.channel;
  }

  public async notify(alert: UrgentFieldReportAlert): Promise<void> {
    if (alert.recipients.length === 0) return;

    const { subject, text, html } = urgentFieldReportEmailBody(alert);
    await this.mail.send({
      to: alert.recipients.map((recipient) => recipient.email),
      subject,
      text,
      html,
    });
  }
}
