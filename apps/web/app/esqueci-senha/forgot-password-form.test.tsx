import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ForgotPasswordForm } from './forgot-password-form';

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pede só o e-mail institucional e aponta de volta para o login', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail institucional')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('recusa e-mail que não é da Unicamp antes de chamar a API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText('E-mail institucional'), {
      target: { value: 'usuario@gmail.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Informe o seu e-mail institucional da Unicamp.',
      );
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('confirma o envio sem dizer se a conta existe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ acknowledged: true }) }),
    );
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText('E-mail institucional'), {
      target: { value: 'usuario@unicamp.br' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Se existir uma conta ativa/);
    });
    expect(screen.queryByRole('status')).not.toHaveTextContent(/cadastrad|não existe/i);
  });

  it('traduz o código de limite de tentativas da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ code: 'AUTH_RATE_LIMIT_EXCEEDED' }),
      }),
    );
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText('E-mail institucional'), {
      target: { value: 'usuario@unicamp.br' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Aguarde um minuto/);
    });
  });
});
