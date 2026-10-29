import type { RequestPasswordResetInput, RequestPasswordResetResponse } from '@arqueia/contracts';

import type { AuditEventWriter } from '../domain/ports/audit-event-writer.port.js';
import type { LocalIdentityReader } from '../domain/ports/local-identity-reader.port.js';
import type { PasswordResetNotifier } from '../domain/ports/password-reset-notifier.port.js';
import type { PasswordResetTokenWriter } from '../domain/ports/password-reset-token-repository.port.js';
import type { SecureTokenGenerator } from '../domain/ports/secure-token-generator.port.js';
import {
  hashPasswordResetToken,
  passwordResetUrl,
} from '../domain/services/password-reset-token.js';

const ANONYMOUS_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

export interface PasswordResetRequestContext {
  readonly origin: string;
  readonly requestId: string | null;
}

export interface PasswordResetLinkSettings {
  readonly publicOrigin: string;
  readonly basePath: string;
  readonly tokenTtlSeconds: number;
}

/**
 * "Esqueci minha senha": emite um token de uso único e manda o link para o
 * e-mail institucional da conta.
 *
 * A resposta é a mesma exista ou não a conta, e nenhum erro de entrega vaza
 * para quem pediu — senão o formulário viraria um verificador de quem tem
 * conta no Arqueia. O que aconteceu de fato fica na auditoria.
 */
export class RequestPasswordResetUseCase {
  public constructor(
    private readonly identities: LocalIdentityReader,
    private readonly tokens: PasswordResetTokenWriter,
    private readonly notifier: PasswordResetNotifier,
    private readonly tokenGenerator: SecureTokenGenerator,
    private readonly auditEvents: AuditEventWriter,
    private readonly settings: PasswordResetLinkSettings,
  ) {}

  public async execute(
    input: RequestPasswordResetInput,
    context: PasswordResetRequestContext,
  ): Promise<RequestPasswordResetResponse> {
    const account = await this.identities.findActiveByEmail(input.email);
    const isEligible =
      account !== null &&
      account.principal.user.status === 'ACTIVE' &&
      account.principal.user.archivedAt === null;

    if (!isEligible) {
      await this.auditEvents.append({
        actorId: null,
        laboratoryId: null,
        action: 'identity.password_reset.requested',
        entity: 'User',
        entityId: account?.principal.user.id ?? ANONYMOUS_ENTITY_ID,
        before: null,
        after: { delivered: false, reason: 'unknown_or_inactive_account' },
        origin: context.origin,
        requestId: context.requestId,
      });
      return { acknowledged: true };
    }

    const { user } = account.principal;
    const token = this.tokenGenerator.generate();
    const expiresAt = new Date(Date.now() + this.settings.tokenTtlSeconds * 1000).toISOString();

    // Um pedido novo cancela os anteriores: dois links válidos ao mesmo tempo
    // só ampliam a janela em que um e-mail antigo ainda abre a conta.
    await this.tokens.invalidatePending(user.id);
    await this.tokens.issue({
      userId: user.id,
      tokenHash: hashPasswordResetToken(token),
      expiresAt,
      origin: context.origin,
    });

    let delivered = true;
    let failureReason: string | null = null;
    try {
      await this.notifier.sendResetLink({
        email: user.email,
        name: user.name,
        resetUrl: passwordResetUrl(this.settings.publicOrigin, this.settings.basePath, token),
        expiresAt,
      });
    } catch (error) {
      delivered = false;
      failureReason = error instanceof Error ? error.message : 'unknown_delivery_error';
    }

    await this.auditEvents.append({
      actorId: user.id,
      laboratoryId: null,
      action: 'identity.password_reset.requested',
      entity: 'User',
      entityId: user.id,
      before: null,
      after: {
        delivered,
        channel: this.notifier.channel,
        expiresAt,
        ...(failureReason === null ? {} : { failureReason }),
      },
      origin: context.origin,
      requestId: context.requestId,
    });

    return { acknowledged: true };
  }
}
