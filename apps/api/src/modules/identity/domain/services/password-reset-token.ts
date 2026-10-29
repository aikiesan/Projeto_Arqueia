import { createHash } from 'node:crypto';

/**
 * O banco só guarda o SHA-256 do token. Sem sal e sem KDF de senha de
 * propósito: o token já é 32 bytes aleatórios, não tem o que adivinhar, e o
 * consumo precisa ser uma busca por igualdade em um índice.
 */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Monta o link que vai no e-mail. `basePath` existe porque na VM do CP2b a
 * aplicação não mora na raiz do domínio, e um link sem o prefixo cai em 404.
 */
export function passwordResetUrl(
  publicOrigin: string,
  basePath: string,
  token: string,
): string {
  const origin = publicOrigin.replace(/\/+$/, '');
  const prefix = basePath === '' ? '' : `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${prefix}/redefinir-senha?token=${encodeURIComponent(token)}`;
}
