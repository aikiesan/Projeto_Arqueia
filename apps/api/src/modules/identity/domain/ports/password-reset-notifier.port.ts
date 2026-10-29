export interface PasswordResetInvitation {
  readonly email: string;
  readonly name: string;
  readonly resetUrl: string;
  readonly expiresAt: string;
}

/**
 * Entrega do link de redefinição. O domínio não sabe que existe SMTP: a porta
 * fala de "avisar o dono da conta", e o adaptador decide como (AGENTS.md §3, D).
 */
export interface PasswordResetNotifier {
  /**
   * Por onde o aviso saiu. Vai para a auditoria: sem ele, o log de uma
   * instalação sem SMTP diria "entregue" para um link que ninguém recebeu.
   */
  readonly channel: 'smtp' | 'log';
  sendResetLink(invitation: PasswordResetInvitation): Promise<void>;
}

export const PASSWORD_RESET_NOTIFIER = Symbol('PASSWORD_RESET_NOTIFIER');
