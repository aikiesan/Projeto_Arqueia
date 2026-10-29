import { describe, expect, it } from 'vitest';

import { LoggingMailSender } from '../../../shared/infrastructure/mailer.module.js';
import {
  MailPasswordResetNotifier,
  passwordResetEmailBody,
} from './mail-password-reset-notifier.js';

const invitation = {
  email: 'usuario@unicamp.br',
  name: 'Usuário Unicamp',
  resetUrl: 'https://cp2b.unicamp.br/arqueia/redefinir-senha?token=abc',
  expiresAt: '2026-08-14T15:00:00.000Z',
};

describe('passwordResetEmailBody', () => {
  it('carries the link and the expiry in both the text and the HTML part', () => {
    const { subject, text, html } = passwordResetEmailBody(invitation);

    expect(subject).toContain('Arqueia');
    expect(text).toContain(invitation.resetUrl);
    expect(html).toContain(invitation.resetUrl);
    expect(text).toContain('só pode ser usado uma vez');
  });

  it('escapes the name, so a crafted one cannot inject markup into the message', () => {
    const { html } = passwordResetEmailBody({
      ...invitation,
      name: '<img src=x onerror="alert(1)">',
    });

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('tells the reader that an unexpected message can be ignored', () => {
    const { text } = passwordResetEmailBody(invitation);

    expect(text).toContain('ignore esta mensagem');
  });
});

describe('MailPasswordResetNotifier', () => {
  it('reporta o canal do transporte, para a auditoria não registrar um envio que não houve', () => {
    expect(new MailPasswordResetNotifier(new LoggingMailSender()).channel).toBe('log');
  });

  it('entrega a mensagem ao transporte, endereçada a quem pediu', async () => {
    const sent: unknown[] = [];
    const notifier = new MailPasswordResetNotifier({
      channel: 'smtp',
      send: (message) => {
        sent.push(message);
        return Promise.resolve();
      },
    });

    await notifier.sendResetLink(invitation);

    expect(sent).toEqual([
      expect.objectContaining({
        to: ['usuario@unicamp.br'],
        subject: expect.stringContaining('Arqueia'),
      }),
    ]);
  });
});
