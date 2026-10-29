import {
  fieldReportReference,
  type ParsedSubmitFieldReportInput,
  type SubmitFieldReportResult,
} from '@arqueia/contracts';

import type { AuditEventWriter } from '../../identity/domain/ports/audit-event-writer.port.js';
import type {
  FieldReportRequestContext,
  PublicFieldReportGateway,
} from '../domain/ports/field-report-repository.port.js';
import type {
  FieldReportAlertRecipientReader,
  UrgentFieldReportNotifier,
} from '../domain/ports/urgent-field-report-alert.port.js';
import {
  assessFieldReportUrgency,
  type UrgencyReason,
} from '../domain/field-report-urgency.js';

export interface FieldReportAlertSettings {
  readonly publicOrigin: string;
  readonly basePath: string;
}

/** Monta o link da triagem, com o prefixo da implantação (ver VM do CP2b). */
export function fieldReportReviewUrl(settings: FieldReportAlertSettings): string {
  const origin = settings.publicOrigin.replace(/\/+$/, '');
  const prefix = settings.basePath === '' ? '' : `/${settings.basePath.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${prefix}/informes`;
}

/**
 * Recebe um informe enviado pela etiqueta QR, sem login.
 *
 * Não há principal para autorizar: o formulário é aberto por decisão do
 * laboratório. Quem protege a porta é o limite de envios por origem (guard) e
 * o contrato, que só aceita os campos do formulário. A resposta devolve apenas
 * o protocolo — quem enviou não lê o informe de volta.
 *
 * Quando o informe indica emergência (ver `assessFieldReportUrgency`), a
 * coordenação é avisada por e-mail. O aviso acontece DEPOIS da gravação e
 * nunca derruba o envio: um relay de e-mail fora do ar não pode fazer o
 * laboratório perder o registro de um acidente. O desfecho da entrega vai para
 * a auditoria.
 */
export class SubmitFieldReportUseCase {
  public constructor(
    private readonly gateway: PublicFieldReportGateway,
    private readonly recipients: FieldReportAlertRecipientReader,
    private readonly notifier: UrgentFieldReportNotifier,
    private readonly auditEvents: AuditEventWriter,
    private readonly settings: FieldReportAlertSettings,
  ) {}

  public async execute(
    input: ParsedSubmitFieldReportInput,
    context: FieldReportRequestContext,
  ): Promise<SubmitFieldReportResult> {
    const submitted = await this.gateway.submit(input, context);
    const reference = fieldReportReference(submitted.id);

    const urgency = assessFieldReportUrgency({
      message: input.message,
      blocksUse: input.blocksUse,
    });
    if (urgency.urgent) {
      // Última rede: nem a gravação da auditoria do alerta pode fazer o envio
      // falhar. O informe já está no banco com a sua própria auditoria; devolver
      // erro aqui faria quem relatou um acidente achar que nada foi registrado,
      // e reenviar.
      try {
        await this.alert(input, submitted, reference, urgency.reasons, context);
      } catch {
        // Intencionalmente silencioso. Ver comentário acima.
      }
    }

    return { reference, receivedAt: submitted.createdAt };
  }

  private async alert(
    input: ParsedSubmitFieldReportInput,
    submitted: { readonly id: string; readonly createdAt: string },
    reference: string,
    reasons: readonly UrgencyReason[],
    context: FieldReportRequestContext,
  ): Promise<void> {
    let recipientCount = 0;
    let delivered = true;
    let failureReason: string | null = null;

    try {
      const people = await this.recipients.listForLaboratory(input.laboratoryId);
      recipientCount = people.length;
      await this.notifier.notify({
        reference,
        kind: input.kind,
        message: input.message,
        blocksUse: input.blocksUse,
        reporterName: input.reporterName,
        reporterContact: input.reporterContact,
        reasons,
        submittedAt: submitted.createdAt,
        reviewUrl: fieldReportReviewUrl(this.settings),
        recipients: people,
      });
    } catch (error) {
      delivered = false;
      failureReason = error instanceof Error ? error.message : 'unknown_delivery_error';
    }

    // Auditoria mesmo quando ninguém foi avisado: um laboratório sem revisor
    // cadastrado é justamente o caso que precisa aparecer na trilha.
    await this.auditEvents.append({
      actorId: null,
      laboratoryId: input.laboratoryId,
      action: 'field-report.urgent.alerted',
      entity: 'FieldReport',
      entityId: submitted.id,
      before: null,
      after: {
        // "Entregue" só quando a mensagem de fato saiu: sem SMTP o transporte
        // é o de log, e registrar entrega aqui esconderia justamente o caso em
        // que ninguém foi avisado.
        delivered: delivered && recipientCount > 0 && this.notifier.channel === 'smtp',
        channel: this.notifier.channel,
        recipientCount,
        reasons,
        ...(failureReason === null ? {} : { failureReason }),
      },
      origin: context.origin,
      requestId: context.requestId,
    });
  }
}
