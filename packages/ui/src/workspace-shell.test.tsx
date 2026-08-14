import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkspaceShell, type WorkspaceShellProps } from './workspace-shell';

const props: WorkspaceShellProps = {
  activeLaboratoryId: 'lab-cp2b',
  activeModuleHref: '/',
  appName: 'Arqueia',
  children: <p>Resumo operacional</p>,
  contextualPanel: <p>Próxima reserva</p>,
  currentContext: 'Laboratório CP2b',
  laboratories: [
    { href: '/?lab=cp2b', id: 'lab-cp2b', logoSrc: '/brand/cp2b-avatar.svg', name: 'Laboratório CP2b', shortName: 'CP' },
    { href: '/?lab=bioma', id: 'lab-bioma', name: 'Laboratório BIOMA', shortName: 'BI' },
  ],
  mobileNavigation: [
    { href: '/', icon: 'inicio', label: 'Início' },
    { href: '/agenda', icon: 'agenda', label: 'Agenda' },
    { href: '/estoque', icon: 'estoque', label: 'Estoque' },
    { href: '/mais', icon: 'mais', label: 'Mais' },
  ],
  moduleNavigation: [
    { href: '/', icon: 'inicio', label: 'Visão geral' },
    { href: '/estoque', icon: 'estoque', label: 'Estoque' },
  ],
  qrAction: { href: '/qr', label: 'Ler QR Code' },
  sectionLabel: 'Hoje no laboratório',
  userInitials: 'LS',
  userLabel: 'Lucas Silva',
};

describe('WorkspaceShell', () => {
  it('expõe as quatro ações mobile e a ação central de QR Code', () => {
    render(<WorkspaceShell {...props} />);

    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação principal' });
    for (const label of ['Início', 'Agenda', 'Estoque', 'Mais']) {
      expect(within(mobileNavigation).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(mobileNavigation).getByRole('link', { name: 'Ler QR Code' })).toHaveAttribute('href', '/qr');
  });

  it('expõe rail, módulos, conteúdo e painel contextual no mesmo shell responsivo', () => {
    render(<WorkspaceShell {...props} />);

    const laboratoryNavigation = screen.getByRole('complementary', { name: 'Laboratórios' });
    expect(within(laboratoryNavigation).getByRole('link', { name: 'Laboratório CP2b' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hoje no laboratório' })).toBeInTheDocument();
    expect(screen.getByText('Resumo operacional')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Guia de Uso' })).toHaveAttribute('href', '/guia');
    expect(screen.getByRole('complementary', { name: 'Painel contextual' })).toHaveTextContent('Próxima reserva');
  });

  it('limita as dimensoes intrinsecas dos logos do laboratorio', () => {
    const { container } = render(<WorkspaceShell {...props} />);

    expect(container.querySelector('.arqueia-brand-logo')).toHaveAttribute('width', '46');
    expect(container.querySelector('.arqueia-brand-logo')).toHaveAttribute('height', '46');

    const railLogo = container.querySelector('.arqueia-lab-link .arqueia-lab-logo');
    expect(railLogo).toHaveAttribute('width', '42');
    expect(railLogo).toHaveAttribute('height', '42');

    const mobileLogo = container.querySelector('.arqueia-mobile-brand-mark .arqueia-lab-logo');
    expect(mobileLogo).toHaveAttribute('width', '38');
    expect(mobileLogo).toHaveAttribute('height', '38');
  });
});
