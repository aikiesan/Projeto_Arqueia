'use client';

import { localLoginInputSchema, type OidcProviderMetadata } from '@arqueia/contracts';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  INVALID_INPUT: 'Revise o e-mail e a senha informados.',
  INVALID_ORIGIN: 'Origem da requisição não confiável. Recarregue a página.',
  API_UNAVAILABLE: 'Não foi possível entrar agora. Tente novamente em instantes.',
};

function messageForCode(code: unknown): string {
  return (typeof code === 'string' ? ERROR_MESSAGES[code] : undefined) ?? 'Não foi possível entrar agora. Tente novamente em instantes.';
}

export function LoginForm({
  next,
  oidc,
}: {
  readonly next: string;
  readonly oidc: OidcProviderMetadata;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = localLoginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(ERROR_MESSAGES.INVALID_INPUT ?? 'Revise o e-mail e a senha informados.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/session/login', {
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
      // Force a full navigation so server components re-read the new session cookie.
      window.location.assign(next);
    } catch {
      setError(ERROR_MESSAGES.API_UNAVAILABLE ?? 'Não foi possível entrar agora. Tente novamente em instantes.');
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="auth-title">
      <section className="login-brand-panel" aria-label="Arqueia">
        <div className="login-brand-lockup">
          <div className="login-product-lockup">
            <span className="login-product-mark" aria-hidden="true">
              <Image alt="" height={34} src="/brand/cp2b-avatar.svg" width={34} />
            </span>
            <div><strong>Arqueia</strong><small>gestão de infraestrutura laboratorial</small></div>
          </div>
          <div className="login-cp2b-endorsement">
            <span>Uma plataforma</span>
            <Image alt="CP2b" height={63} priority src="/brand/cp2b-logo.svg" width={166} />
          </div>
        </div>
        <div className="login-brand-message">
          <span className="login-brand-kicker">Infraestrutura laboratorial</span>
          <h1>Compartilhar recursos. Ampliar descobertas.</h1>
          <p>Gestão, rastreabilidade e planejamento para a comunidade CP2b.</p>
        </div>
      </section>
      <section className="login-card">
        <div className="login-card-brand">
          <span className="login-arqueia-mark" aria-hidden="true">A</span>
          <div><strong>Arqueia</strong><small>Projeto CP2b</small></div>
        </div>
        <span className="section-kicker">Acesso seguro</span>
        <h2 id="auth-title">Entrar no Arqueia</h2>
        <p>Use as credenciais da sua conta para continuar.</p>
        <form className="login-form" noValidate onSubmit={handleSubmit}>
          <label htmlFor="email">
            <span>E-mail</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              autoFocus
              id="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu.email@instituicao.br"
              required
              spellCheck="false"
              type="email"
              value={email}
            />
          </label>

          <label htmlFor="password">
            <span>Senha</span>
            <input
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect="off"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              spellCheck="false"
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">{error}</p>
          ) : null}

          <button className="primary-button login-submit" disabled={submitting} type="submit">
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {oidc.enabled && oidc.authorizationUrl ? (
          <a className="secondary-button login-submit" href={oidc.authorizationUrl}>{oidc.displayName}</a>
        ) : null}
        <p className="login-security">Sua sessão é protegida e as permissões são verificadas no servidor.</p>
        <div className="login-cp2b-mobile">
          <span>Uma iniciativa</span>
          <Image alt="CP2b" height={50} src="/brand/cp2b-logo.svg" width={132} />
        </div>
      </section>
    </main>
  );
}
