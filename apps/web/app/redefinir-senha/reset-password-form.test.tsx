import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResetPasswordForm } from './reset-password-form';

const token = 'b'.repeat(64);

function fillPasswords(password: string, confirmation = password): void {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repita a nova senha'), {
    target: { value: confirmation },
  });
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('manda pedir outro link quando a URL não traz token', () => {
    render(<ResetPasswordForm token="" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/não traz um link de redefinição válido/);
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('recusa quando as duas senhas não batem, sem chamar a API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<ResetPasswordForm token={token} />);

    fillPasswords('senha-nova-123', 'senha-nova-124');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('As duas senhas não são iguais.');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('recusa senha curta demais antes de chamar a API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<ResetPasswordForm token={token} />);

    fillPasswords('curta');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/pelo menos 12 caracteres/);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envia token e nova senha, e confirma a troca', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    render(<ResetPasswordForm token={token} />);

    fillPasswords('senha-nova-123');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Senha redefinida. Já pode entrar com ela.');
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ token, newPassword: 'senha-nova-123' });
  });

  it('explica em português que o link expirou ou já foi usado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ code: 'INVALID_PASSWORD_RESET_TOKEN' }),
      }),
    );
    render(<ResetPasswordForm token={token} />);

    fillPasswords('senha-nova-123');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/expirou ou já foi usado/);
    });
  });
});
