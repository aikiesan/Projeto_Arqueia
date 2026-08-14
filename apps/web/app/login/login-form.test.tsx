import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

const mockOidcDisabled = {
  enabled: false,
  displayName: 'SSO',
  authorizationUrl: null,
};

const mockOidcEnabled = {
  enabled: true,
  displayName: 'Entrar com Google Workspace',
  authorizationUrl: 'https://auth.example.com/oauth/authorize',
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form elements and accessibility labels cleanly', () => {
    render(<LoginForm next="/" oidc={mockOidcDisabled} />);

    expect(screen.getByRole('heading', { name: 'Entrar no Arqueia' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(
      screen.getByText('Sua sessão é protegida e as permissões são verificadas no servidor.'),
    ).toBeInTheDocument();
  });

  it('renders mobile brand endorsement panel', () => {
    const { container } = render(<LoginForm next="/" oidc={mockOidcDisabled} />);
    expect(container.querySelector('.login-cp2b-mobile')).toBeInTheDocument();
    expect(screen.getByText('Uma iniciativa')).toBeInTheDocument();
  });

  it('shows error when submitting invalid email format', async () => {
    render(<LoginForm next="/" oidc={mockOidcDisabled} />);

    const emailInput = screen.getByLabelText('E-mail');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Revise o e-mail e a senha informados.');
    });
  });

  it('renders SSO button when OIDC is enabled', () => {
    render(<LoginForm next="/" oidc={mockOidcEnabled} />);

    const ssoLink = screen.getByRole('link', { name: 'Entrar com Google Workspace' });
    expect(ssoLink).toBeInTheDocument();
    expect(ssoLink).toHaveAttribute('href', 'https://auth.example.com/oauth/authorize');
  });

  it('smoke tests viewport scaling on mobile (Samsung S21 360px and iPhone 15/16 393px)', () => {
    // 360px Samsung S21 Portrait
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 });
    window.dispatchEvent(new Event('resize'));
    const { container: s21Container } = render(<LoginForm next="/" oidc={mockOidcDisabled} />);
    expect(s21Container.querySelector('.login-card')).toBeInTheDocument();
    expect(s21Container.querySelector('.login-page')).toBeInTheDocument();

    // 393px iPhone 15/16 Portrait
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 393 });
    window.dispatchEvent(new Event('resize'));
    const { container: iphoneContainer } = render(<LoginForm next="/" oidc={mockOidcDisabled} />);
    expect(iphoneContainer.querySelector('.login-card')).toBeInTheDocument();
    expect(iphoneContainer.querySelector('.login-page')).toBeInTheDocument();
  });
});
