import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import type {
  PasswordResetInvitation,
  PasswordResetNotifier,
} from '../domain/ports/password-reset-notifier.port.js';

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export function passwordResetEmailBody(invitation: PasswordResetInvitation): {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
} {
  const expiry = formatExpiry(invitation.expiresAt);
  const subject = 'Arqueia — redefinição de senha';
  const text = [
    `Olá, ${invitation.name}.`,
    '',
    'Alguém pediu a redefinição da senha da sua conta no Arqueia. Para escolher',
    'uma senha nova, abra o link abaixo:',
    '',
    invitation.resetUrl,
    '',
    `O link vale até ${expiry} e só pode ser usado uma vez.`,
    '',
    'Se não foi você quem pediu, ignore esta mensagem: sua senha continua a mesma.',
    '',
    'Arqueia — CP2b/Unicamp',
  ].join('\n');
  const html = [
    `<p>Olá, ${escapeHtml(invitation.name)}.</p>`,
    '<p>Alguém pediu a redefinição da senha da sua conta no Arqueia. Para escolher uma senha nova, abra o link abaixo:</p>',
    `<p><a href="${escapeHtml(invitation.resetUrl)}">Redefinir minha senha</a></p>`,
    `<p>O link vale até <strong>${escapeHtml(expiry)}</strong> e só pode ser usado uma vez.</p>`,
    '<p>Se não foi você quem pediu, ignore esta mensagem: sua senha continua a mesma.</p>',
    '<p>Arqueia — CP2b/Unicamp</p>',
  ].join('\n');

  return { subject, text, html };
}

export class SmtpPasswordResetNotifier implements PasswordResetNotifier {
  public readonly channel = 'smtp' as const;

  private transporter: Transporter | undefined;

  public constructor(private readonly settings: SmtpSettings) {}

  public async sendResetLink(invitation: PasswordResetInvitation): Promise<void> {
    const { subject, text, html } = passwordResetEmailBody(invitation);
    this.transporter ??= createTransport({
      host: this.settings.host,
      port: this.settings.port,
      secure: this.settings.port === 465,
      ...(this.settings.user === ''
        ? {}
        : { auth: { user: this.settings.user, pass: this.settings.password } }),
    });

    await this.transporter.sendMail({
      from: this.settings.from,
      to: invitation.email,
      subject,
      text,
      html,
    });
  }
}

/**
 * Sem SMTP configurado o link vai para o log da API, e não para o vazio: em
 * desenvolvimento é assim que se completa o fluxo. O aviso em nível de alerta
 * existe para que isso não passe despercebido se escapar para a VM.
 */
export class LoggingPasswordResetNotifier implements PasswordResetNotifier {
  public readonly channel = 'log' as const;

  private readonly logger = new Logger('PasswordReset');

  public sendResetLink(invitation: PasswordResetInvitation): Promise<void> {
    this.logger.warn(
      `SMTP não configurado — link de redefinição de ${invitation.email} não foi enviado por e-mail: ${invitation.resetUrl}`,
    );
    return Promise.resolve();
  }
}
