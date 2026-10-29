import type { MailSender } from '../../../shared/infrastructure/mailer.module.js';
import type {
  PasswordResetInvitation,
  PasswordResetNotifier,
} from '../domain/ports/password-reset-notifier.port.js';

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

/**
 * Traduz o convite de redefinição para uma mensagem e entrega ao transporte
 * compartilhado. Não conhece SMTP: se o transporte for o de log, o canal
 * reportado muda junto, e a auditoria não registra um envio que não houve.
 */
export class MailPasswordResetNotifier implements PasswordResetNotifier {
  public constructor(private readonly mail: MailSender) {}

  public get channel(): 'smtp' | 'log' {
    return this.mail.channel;
  }

  public async sendResetLink(invitation: PasswordResetInvitation): Promise<void> {
    const { subject, text, html } = passwordResetEmailBody(invitation);
    await this.mail.send({ to: [invitation.email], subject, text, html });
  }
}
