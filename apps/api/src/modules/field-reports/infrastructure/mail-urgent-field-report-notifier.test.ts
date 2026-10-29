import { describe, expect, it, vi } from 'vitest';

import { LoggingMailSender } from '../../../shared/infrastructure/mailer.module.js';
import type { UrgentFieldReportAlert } from '../domain/ports/urgent-field-report-alert.port.js';
import {
  MailUrgentFieldReportNotifier,
  describeReasons,
  urgentFieldReportEmailBody,
} from './mail-urgent-field-report-notifier.js';
import {
  laboratoryRolesThatReview,
  systemRolesThatReview,
} from './postgres-field-report-alert-recipient-reader.js';

const alert: UrgentFieldReportAlert = {
  reference: 'INF-5A6B7C8D',
  kind: 'EQUIPMENT_PROBLEM',
  message: 'SOCORRRO, vazamento de solvente na capela.',
  blocksUse: true,
  reporterName: 'Ana',
  reporterContact: 'ana@unicamp.br',
  reasons: ['blocks_use', 'keyword:vazamento'],
  submittedAt: '2026-10-29T13:00:00.000Z',
  reviewUrl: 'https://cp2b.unicamp.br/arqueia/informes',
  recipients: [
    { name: 'Fabi', email: 'fabimv@unicamp.br' },
    { name: 'Lucas', email: 'lucasnc@unicamp.br' },
  ],
};

describe('describeReasons', () => {
  it('explica em português por que o alerta disparou', () => {
    expect(describeReasons(['blocks_use', 'keyword:vazamento', 'keyword:urgente'])).toEqual([
      'quem enviou marcou que o equipamento não pode ser usado',
      'a mensagem contém "vazamento", "urgente"',
    ]);
  });
});

describe('urgentFieldReportEmailBody', () => {
  it('põe o protocolo no assunto e sinaliza equipamento parado', () => {
    const { subject } = urgentFieldReportEmailBody(alert);

    expect(subject).toContain('INF-5A6B7C8D');
    expect(subject).toContain('equipamento parado');
  });

  it('carrega mensagem, motivo, quem enviou e o link da triagem', () => {
    const { text, html } = urgentFieldReportEmailBody(alert);

    for (const body of [text, html]) {
      expect(body).toContain('vazamento de solvente');
      expect(body).toContain('https://cp2b.unicamp.br/arqueia/informes');
      expect(body).toContain('ana@unicamp.br');
    }
  });

  it('diz quando quem enviou não se identificou, em vez de deixar vazio', () => {
    const { text } = urgentFieldReportEmailBody({
      ...alert,
      reporterName: null,
      reporterContact: null,
    });

    expect(text).toContain('Não se identificou.');
  });

  it('escapa a mensagem, que vem da internet aberta e não é confiável', () => {
    const { html } = urgentFieldReportEmailBody({
      ...alert,
      message: '<img src=x onerror="alert(1)"> vazamento',
    });

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('avisa que quem enviou não recebe cópia', () => {
    expect(urgentFieldReportEmailBody(alert).text).toContain('não recebe cópia');
  });
});

describe('MailUrgentFieldReportNotifier', () => {
  it('endereça a todos os revisores de uma vez', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await new MailUrgentFieldReportNotifier({ channel: 'smtp', send }).notify(alert);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['fabimv@unicamp.br', 'lucasnc@unicamp.br'] }),
    );
  });

  it('não tenta enviar quando não há a quem avisar', async () => {
    const send = vi.fn();
    await new MailUrgentFieldReportNotifier({ channel: 'smtp', send }).notify({
      ...alert,
      recipients: [],
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('reporta o canal do transporte, para a auditoria não mentir sobre o envio', () => {
    expect(new MailUrgentFieldReportNotifier(new LoggingMailSender()).channel).toBe('log');
  });
});

describe('destinatários derivados das permissões', () => {
  /**
   * Trava a fonte da verdade: a lista vem do mapa de permissões, não de nomes
   * escritos à mão. Se alguém der ou tirar `field-report.review` de um papel,
   * é aqui que a mudança aparece.
   */
  it('inclui exatamente os papéis que podem revisar informes', () => {
    expect(laboratoryRolesThatReview()).toEqual(['GESTOR_ACESSO_CP2B']);
    expect(systemRolesThatReview()).toEqual(['ADMIN']);
  });

  it('não inclui quem só usa o laboratório', () => {
    expect(laboratoryRolesThatReview()).not.toContain('USUARIO');
  });
});
