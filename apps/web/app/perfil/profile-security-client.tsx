'use client';

import { useState, type FormEvent } from 'react';

export function ProfileSecurityClient({ required = false }: { readonly required?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (newPassword.length < 12) {
      setError('A nova senha deve ter no mínimo 12 caracteres.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
        if (res.status === 401 || body?.code === 'INVALID_CREDENTIALS') {
          throw new Error('Senha atual incorreta.');
        }
        throw new Error(body?.message ?? 'Não foi possível alterar a senha.');
      }

      setNotice('✅ Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (required) window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar senha.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1.5rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
      }}
    >
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Segurança da Conta & Alteração de Senha</h3>
      {required ? (
        <p className="form-error" role="alert">
          Troque a senha provisória antes de utilizar os demais módulos.
        </p>
      ) : null}
      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem' }}>
        Atualize sua senha de acesso periodicamente. Mínimo de 12 caracteres com boa complexidade.
      </p>

      {notice && (
        <div
          style={{
            background: '#e6fffa',
            border: '1px solid #38b2ac',
            color: '#234e52',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            color: '#c53030',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: '1rem', maxWidth: '450px' }}>
        <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <span>Senha Atual *</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Digite sua senha atual"
            required
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e0' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <span>Nova Senha * (mínimo 12 caracteres)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha"
            minLength={12}
            maxLength={128}
            required
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e0' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <span>Confirmar Nova Senha *</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme a nova senha"
            minLength={12}
            maxLength={128}
            required
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e0' }}
          />
        </label>

        <button
          className="primary-button"
          disabled={pending || !currentPassword || !newPassword || !confirmPassword}
          type="submit"
          style={{ width: 'fit-content', marginTop: '0.5rem' }}
        >
          {pending ? 'Salvando...' : 'Atualizar Minha Senha'}
        </button>
      </form>
    </section>
  );
}
