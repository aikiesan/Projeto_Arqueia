export interface IssuePasswordResetTokenRecord {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly origin: string;
}

/**
 * Emissão de tokens de redefinição. Separada do consumo de propósito: o pedido
 * de redefinição (público, sem sessão) só precisa escrever, e o consumo só
 * precisa trocar o token por um usuário (AGENTS.md §3, segregação de interface).
 */
export interface PasswordResetTokenWriter {
  /** Invalida os tokens pendentes do usuário antes de emitir um novo. */
  invalidatePending(userId: string): Promise<void>;
  issue(record: IssuePasswordResetTokenRecord): Promise<void>;
}

export interface ConsumedPasswordResetToken {
  readonly id: string;
  readonly userId: string;
}

export interface PasswordResetTokenConsumer {
  /**
   * Marca o token como usado e devolve o dono, em uma única operação atômica.
   * Devolve `null` quando o token não existe, já foi usado ou expirou — ler e
   * depois marcar abriria uma janela para dois pedidos usarem o mesmo token
   * (AGENTS.md §4.3: concorrência se resolve no banco).
   */
  consume(tokenHash: string): Promise<ConsumedPasswordResetToken | null>;
}

export const PASSWORD_RESET_TOKEN_WRITER = Symbol('PASSWORD_RESET_TOKEN_WRITER');
export const PASSWORD_RESET_TOKEN_CONSUMER = Symbol('PASSWORD_RESET_TOKEN_CONSUMER');
