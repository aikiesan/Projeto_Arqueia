import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form elements and accessibility labels cleanly', () => {
    const { container } = render(<LoginForm next="/" />);

    expect(screen.getByRole('heading', { name: 'Entrar no Arqueia' })).toBeInTheDocument();
    expect(screen.getByLabelText('Código de acesso')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
    expect(
      screen.getByText('Sua sessão é protegida e as permissões são verificadas no servidor.'),
    ).toBeInTheDocument();
  });

  it('renders mobile brand endorsement panel', () => {
    const { container } = render(<LoginForm next="/" />);
    expect(container.querySelector('.login-cp2b-mobile')).toBeInTheDocument();
    expect(screen.getByText('Uma iniciativa')).toBeInTheDocument();
  });

  it('shows error when submitting an invalid login code', async () => {
    render(<LoginForm next="/" />);

    const loginCodeInput = screen.getByLabelText('Código de acesso');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });

    fireEvent.change(loginCodeInput, { target: { value: 'inválido!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Revise o código de acesso e a senha informados.');
    });
  });

  it('does not offer institutional SSO in the local-only deployment', () => {
    render(<LoginForm next="/" />);

    expect(screen.queryByRole('link', { name: /Entrar com/ })).not.toBeInTheDocument();
  });

  it('smoke tests viewport scaling on mobile (Samsung S21 360px and iPhone 15/16 393px)', () => {
    // 360px Samsung S21 Portrait
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 });
    window.dispatchEvent(new Event('resize'));
    const { container: s21Container } = render(<LoginForm next="/" />);
    expect(s21Container.querySelector('.login-card')).toBeInTheDocument();
    expect(s21Container.querySelector('.login-page')).toBeInTheDocument();

    // 393px iPhone 15/16 Portrait
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 393 });
    window.dispatchEvent(new Event('resize'));
    const { container: iphoneContainer } = render(<LoginForm next="/" />);
    expect(iphoneContainer.querySelector('.login-card')).toBeInTheDocument();
    expect(iphoneContainer.querySelector('.login-page')).toBeInTheDocument();
  });
});
