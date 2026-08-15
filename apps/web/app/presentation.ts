import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import type { LaboratoryRailItem, NavigationItem } from '@arqueia/ui';

import { principalCan } from './lib/permissions';

export interface WorkspacePresentation {
  readonly activeLaboratoryId: string;
  readonly currentContext: string;
  readonly currentUser: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
  readonly laboratories: readonly LaboratoryRailItem[];
  readonly mobileNavigation: readonly NavigationItem[];
  readonly moduleNavigation: readonly NavigationItem[];
  readonly userInitials: string;
}

const CP2B_LOGO = '/brand/cp2b-avatar.svg';

function withLaboratoryContext(href: string, laboratoryId: string | undefined): string {
  if (!laboratoryId) return href;
  const [pathname = '/', queryString = ''] = href.split('?');
  const query = new URLSearchParams(queryString);
  query.set('laboratory', laboratoryId);
  return `${pathname}?${query.toString()}`;
}

function initials(name: string): string {
  const derived = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return derived || 'A';
}

/**
 * Deriva a apresentação do shell a partir do principal real (usuário logado) e
 * dos laboratórios que ele enxerga. A navegação de "Usuários" só aparece para
 * quem pode ler usuários — mas o acesso real é sempre reavaliado no servidor.
 */
export function createWorkspacePresentation(
  principal: AuthenticatedPrincipal,
  laboratories: readonly Laboratory[],
  activeLaboratoryId?: string,
): WorkspacePresentation {
  const activeLaboratory = laboratories.find(({ id }) => id === activeLaboratoryId) ?? laboratories[0];
  const railItems: readonly LaboratoryRailItem[] = laboratories.map((laboratory) => ({
    href: `/?laboratory=${laboratory.id}`,
    id: laboratory.id,
    ...(laboratory.code === 'CP2b' ? { logoSrc: CP2B_LOGO } : {}),
    name: laboratory.name,
    shortName: laboratory.code.slice(0, 2).toUpperCase(),
  }));
  const moduleNavigation: NavigationItem[] = [
    { description: 'Resumo do laboratório', href: '/', icon: 'inicio', label: 'Visão geral' },
    { description: 'Reservas e bloqueios', href: '/agenda', icon: 'agenda', label: 'Agenda' },
    { description: 'Produtos, lotes e QR', href: '/estoque', icon: 'estoque', label: 'Estoque' },
    {
      description: 'Cadastro e manutenção',
      href: '/equipamentos',
      icon: 'equipamentos',
      label: 'Equipamentos',
    },
  ];
  if (principalCan(principal, 'identity.user.read')) {
    moduleNavigation.push({
      description: 'Equipe e acessos',
      href: '/usuarios',
      icon: 'usuarios',
      label: 'Usuários',
    });
  }
  if (
    principalCan(principal, 'management.report.read', activeLaboratory?.id) ||
    principalCan(principal, 'audit.read', activeLaboratory?.id)
  ) {

    moduleNavigation.push({
      description: 'Indicadores e histórico',
      href: '/gestao',
      icon: 'gestao',
      label: 'Gestão',
    });
  }

  moduleNavigation.push({
    description: 'Manual e documentação',
    href: '/guia',
    icon: 'guia',
    label: 'Guia de Uso',
  });

  const laboratoryId = activeLaboratory?.id;
  const mobileNavigation: NavigationItem[] = [
    { href: '/', icon: 'inicio', label: 'Início' },
    { href: '/agenda', icon: 'agenda', label: 'Agenda' },
    { href: '/estoque', icon: 'estoque', label: 'Estoque' },
    { href: '/mais', icon: 'mais', label: 'Mais' },
  ];

  return {
    activeLaboratoryId: activeLaboratory?.id ?? '',
    currentContext: activeLaboratory?.name ?? 'Arqueia',
    currentUser: {
      id: principal.user.id,
      name: principal.user.name,
      email: principal.user.email,
    },
    laboratories: railItems,
    mobileNavigation: mobileNavigation.map((item) => ({
      ...item,
      href: withLaboratoryContext(item.href, laboratoryId),
    })),
    moduleNavigation: moduleNavigation.map((item) => ({
      ...item,
      href: withLaboratoryContext(item.href, laboratoryId),
    })),
    userInitials: initials(principal.user.name),
  };
}
