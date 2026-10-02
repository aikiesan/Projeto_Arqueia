import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form elements and accessibility labels cleanly', () => {
    const { container } = render(<LoginForm next="/" />);

    expect(screen.getByRole('heading', { name: 'Entrar no Arqueia' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail institucional')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
    expect(
      screen.getByText('Sua sessão é protegida e as permissões são verificadas no servidor.'),
    ).toBeInTheDocument();
  });

  it('mostra antes do formulário os atalhos sem login para agenda e informes', () => {
    const { container } = render(<LoginForm next="/" />);

    const shortcuts = screen.getByRole('navigation', { name: /Sem login/ });
    const agenda = within(shortcuts).getByRole('link', { name: /Ver agenda/ });
    const report = within(shortcuts).getByRole('link', { name: /Informar/ });
    expect(agenda).toHaveAttribute('href', '/agenda-publica');
    expect(report).toHaveAttribute('href', '/informar');

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(shortcuts.compareDocumentPosition(form as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders mobile brand endorsement panel', () => {
    const { container } = render(<LoginForm next="/" />);
    expect(container.querySelector('.login-cp2b-mobile')).toBeInTheDocument();
    expect(screen.getByText('Uma iniciativa')).toBeInTheDocument();
  });

  it('shows error when submitting a non-institutional email', async () => {
    render(<LoginForm next="/" />);

    const emailInput = screen.getByLabelText('E-mail institucional');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });

    fireEvent.change(emailInput, { target: { value: 'usuario@gmail.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Revise o e-mail institucional e a senha informados.');
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
