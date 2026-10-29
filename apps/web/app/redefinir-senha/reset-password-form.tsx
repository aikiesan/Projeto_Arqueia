'use client';

import { completePasswordResetInputSchema } from '@arqueia/contracts';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';

import { navigateTo, withBasePath } from '../lib/base-path';

const MINIMUM_PASSWORD_LENGTH = 12;

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PASSWORD_RESET_TOKEN:
    'Este link não vale mais: ele expirou ou já foi usado. Peça um novo.',
  INVALID_INPUT: 'Revise a nova senha.',
  INVALID_ORIGIN: 'Origem da requisição não confiável. Recarregue a página.',
  AUTH_RATE_LIMIT_EXCEEDED: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
  API_UNAVAILABLE: 'Não foi possível redefinir a senha agora. Tente novamente em instantes.',
};

function messageForCode(code: unknown): string {
  return (
    (typeof code === 'string' ? ERROR_MESSAGES[code] : undefined) ??
    'Não foi possível redefinir a senha agora. Tente novamente em instantes.'
  );
}

export function ResetPasswordForm({ token }: { readonly token: string }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError('As duas senhas não são iguais.');
      return;
    }

    const parsed = completePasswordResetInputSchema.safeParse({ token, newPassword });
    if (!parsed.success) {
      setError(`A nova senha precisa ter pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(withBasePath('/api/auth/password-reset/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { code?: string } | null;
        setError(messageForCode(payload?.code));
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError(ERROR_MESSAGES.API_UNAVAILABLE ?? 'Não foi possível redefinir a senha agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="reset-title">
      <section className="login-card">
        <div className="login-card-brand">
          <span className="login-arqueia-mark" aria-hidden="true">A</span>
          <div><strong>Arqueia</strong><small>Projeto CP2b</small></div>
        </div>

        <span className="section-kicker">Acesso seguro</span>
        <h2 id="reset-title">Escolher nova senha</h2>

        {token === '' ? (
          <>
            <p role="alert">
              Este endereço não traz um link de redefinição válido. Peça um novo pela página
              de login.
            </p>
            <a className="primary-button login-submit" href={withBasePath('/esqueci-senha')}>
              Pedir novo link
            </a>
          </>
        ) : done ? (
          <>
            <p role="status">Senha redefinida. Já pode entrar com ela.</p>
            <button
              className="primary-button login-submit"
              onClick={() => navigateTo('/login')}
              type="button"
            >
              Ir para o login
            </button>
          </>
        ) : (
          <>
            <p>
              A senha precisa ter pelo menos {MINIMUM_PASSWORD_LENGTH} caracteres. Depois de
              salvar, este link deixa de valer.
            </p>
            <form className="login-form" method="post" noValidate onSubmit={handleSubmit}>
              <label htmlFor="new-password">
                <span>Nova senha</span>
                <input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoFocus
                  id="new-password"
                  minLength={MINIMUM_PASSWORD_LENGTH}
                  name="newPassword"
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="••••••••••••"
                  required
                  spellCheck="false"
                  type="password"
                  value={newPassword}
                />
              </label>

              <label htmlFor="confirm-password">
                <span>Repita a nova senha</span>
                <input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect="off"
                  id="confirm-password"
                  minLength={MINIMUM_PASSWORD_LENGTH}
                  name="confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="••••••••••••"
                  required
                  spellCheck="false"
                  type="password"
                  value={confirmation}
                />
              </label>

              {error ? <p className="form-error" role="alert">{error}</p> : null}

              <button className="primary-button login-submit" disabled={submitting} type="submit">
                {submitting ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>

            <p className="login-security">
              O link expirou? <a href={withBasePath('/esqueci-senha')}>Peça outro</a>.
            </p>
          </>
        )}

        <div className="login-cp2b-mobile">
          <span>Uma iniciativa</span>
          <Image alt="CP2b" height={50} src={withBasePath('/brand/cp2b-logo.svg')} width={132} />
        </div>
      </section>
    </main>
  );
}
