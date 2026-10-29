import { Global, Logger, Module } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { loadApiEnvironment } from '../../configuration.js';

export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * Transporte de e-mail da aplicação. É o único lugar que conhece SMTP: cada
 * módulo monta a sua própria mensagem (link de senha, alerta de informe) e
 * entrega aqui, sem saber como ela sai.
 */
export interface MailSender {
  /**
   * Por onde a mensagem saiu. Vai para a auditoria: sem isso, uma instalação
   * sem SMTP registraria "entregue" para e-mail que ninguém recebeu.
   */
  readonly channel: 'smtp' | 'log';
  send(message: MailMessage): Promise<void>;
}

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
}

export class SmtpMailSender implements MailSender {
  public readonly channel = 'smtp' as const;

  private transporter: Transporter | undefined;

  public constructor(private readonly settings: SmtpSettings) {}

  public async send(message: MailMessage): Promise<void> {
    // Um relay institucional costuma liberar por IP de origem; tentar
    // autenticar com usuário em branco faz o servidor recusar a conexão.
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
      to: [...message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

/**
 * Sem SMTP configurado a mensagem vai para o log, e não para o vazio: em
 * desenvolvimento é assim que se completa o fluxo. O aviso em nível de alerta
 * existe para que isso não passe despercebido se escapar para a VM.
 */
export class LoggingMailSender implements MailSender {
  public readonly channel = 'log' as const;

  private readonly logger = new Logger('Mailer');

  public send(message: MailMessage): Promise<void> {
    this.logger.warn(
      `SMTP não configurado — "${message.subject}" não foi enviado para ${message.to.join(', ')}:\n${message.text}`,
    );
    return Promise.resolve();
  }
}

export function createMailSender(
  environment: ReturnType<typeof loadApiEnvironment>,
): MailSender {
  const host = environment.SMTP_HOST?.trim() ?? '';
  if (host === '') return new LoggingMailSender();

  return new SmtpMailSender({
    host,
    port: environment.SMTP_PORT ?? 587,
    user: environment.SMTP_USER?.trim() ?? '',
    password: environment.SMTP_PASSWORD ?? '',
    from:
      environment.SMTP_FROM?.trim() ||
      `Arqueia <nao-responda@${new URL(environment.PUBLIC_ORIGIN).hostname}>`,
  });
}

@Global()
@Module({
  providers: [{ provide: MAIL_SENDER, useFactory: () => createMailSender(loadApiEnvironment()) }],
  exports: [MAIL_SENDER],
})
export class MailerModule {}
