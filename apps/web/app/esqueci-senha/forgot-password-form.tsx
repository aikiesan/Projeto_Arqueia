'use client';

import { requestPasswordResetInputSchema } from '@arqueia/contracts';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';

import { withBasePath } from '../lib/base-path';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: 'Informe o seu e-mail institucional da Unicamp.',
  INVALID_ORIGIN: 'Origem da requisição não confiável. Recarregue a página.',
  AUTH_RATE_LIMIT_EXCEEDED: 'Muitos pedidos seguidos. Aguarde um minuto e tente de novo.',
  API_UNAVAILABLE: 'Não foi possível pedir a redefinição agora. Tente novamente em instantes.',
};

function messageForCode(code: unknown): string {
  return (
    (typeof code === 'string' ? ERROR_MESSAGES[code] : undefined) ??
    'Não foi possível pedir a redefinição agora. Tente novamente em instantes.'
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = requestPasswordResetInputSchema.safeParse({ email });
    if (!parsed.success) {
      setError(ERROR_MESSAGES.INVALID_INPUT ?? 'Informe o seu e-mail institucional da Unicamp.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(withBasePath('/api/auth/password-reset/request'), {
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
      setSent(true);
    } catch {
      setError(ERROR_MESSAGES.API_UNAVAILABLE ?? 'Não foi possível pedir a redefinição agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="forgot-title">
      <section className="login-card">
        <div className="login-card-brand">
          <span className="login-arqueia-mark" aria-hidden="true">A</span>
          <div><strong>Arqueia</strong><small>Projeto CP2b</small></div>
        </div>

        <span className="section-kicker">Acesso seguro</span>
        <h2 id="forgot-title">Esqueceu a senha?</h2>

        {sent ? (
          <>
            {/*
              A mensagem não diz se a conta existe: o formulário não pode virar
              um jeito de descobrir quem tem conta no Arqueia.
            */}
            <p role="status">
              Se existir uma conta ativa com esse e-mail, enviamos para ela um link de
              redefinição. O link vale por uma hora e só pode ser usado uma vez.
            </p>
            <p className="login-security">
              Não chegou? Verifique a caixa de spam e confirme se digitou o e-mail
              institucional certo.
            </p>
            <a className="primary-button login-submit" href={withBasePath('/login')}>
              Voltar para o login
            </a>
          </>
        ) : (
          <>
            <p>
              Informe o seu e-mail institucional. Enviaremos um link para você escolher uma
              senha nova.
            </p>
            <form className="login-form" method="post" noValidate onSubmit={handleSubmit}>
              <label htmlFor="email">
                <span>E-mail institucional</span>
                <input
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect="off"
                  autoFocus
                  id="email"
                  inputMode="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@unicamp.br"
                  required
                  spellCheck="false"
                  type="email"
                  value={email}
                />
              </label>

              {error ? <p className="form-error" role="alert">{error}</p> : null}

              <button className="primary-button login-submit" disabled={submitting} type="submit">
                {submitting ? 'Enviando…' : 'Enviar link de redefinição'}
              </button>
            </form>

            <p className="login-security">
              Lembrou a senha? <a href={withBasePath('/login')}>Voltar para o login</a>
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
