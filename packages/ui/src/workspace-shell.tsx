import type { ReactNode } from 'react';

import { ArqueiaIcon, type ArqueiaIconName } from './icons';

export interface LaboratoryRailItem {
  readonly href: string;
  readonly id: string;
  readonly logoSrc?: string;
  readonly name: string;
  readonly shortName: string;
}

export interface NavigationItem {
  readonly badge?: string;
  readonly description?: string;
  readonly href: string;
  readonly icon: ArqueiaIconName;
  readonly label: string;
}

export interface WorkspaceShellProps {
  readonly activeLaboratoryId: string;
  readonly activeModuleHref: string;
  readonly appName: string;
  readonly children: ReactNode;
  readonly contextualPanel?: ReactNode;
  readonly currentContext: string;
  readonly laboratories: readonly LaboratoryRailItem[];
  readonly mobileNavigation: readonly NavigationItem[];
  readonly moduleNavigation: readonly NavigationItem[];
  readonly qrAction: Pick<NavigationItem, 'href' | 'label'>;
  readonly sectionLabel: string;
  readonly userInitials: string;
  readonly userLabel: string;
  readonly userMenu?: ReactNode;
}

function NavigationLink({ activeHref, compact = false, item }: {
  readonly activeHref: string;
  readonly compact?: boolean;
  readonly item: NavigationItem;
}) {
  const navigationPath = (href: string) => href.split(/[?#]/, 1)[0] || '/';
  const isActive = navigationPath(item.href) === navigationPath(activeHref);

  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={compact ? 'arqueia-mobile-link' : 'arqueia-module-link'}
      href={item.href}
    >
      <ArqueiaIcon name={item.icon} size={compact ? 22 : 19} />
      <span className="arqueia-nav-copy">
        <span className="arqueia-nav-label">{item.label}</span>
        {!compact && item.description ? <span className="arqueia-nav-description">{item.description}</span> : null}
      </span>
      {!compact && item.badge ? <span className="arqueia-nav-badge">{item.badge}</span> : null}
    </a>
  );
}

export function WorkspaceShell({
  activeLaboratoryId,
  activeModuleHref,
  appName,
  children,
  contextualPanel,
  currentContext,
  laboratories,
  mobileNavigation,
  moduleNavigation,
  qrAction,
  sectionLabel,
  userInitials,
  userLabel,
  userMenu,
}: WorkspaceShellProps) {

  const midpoint = Math.ceil(mobileNavigation.length / 2);
  const mobileBeforeQr = mobileNavigation.slice(0, midpoint);
  const mobileAfterQr = mobileNavigation.slice(midpoint);
  const activeLaboratory = laboratories.find((laboratory) => laboratory.id === activeLaboratoryId);

  return (
    <div className="arqueia-workspace">
      <a className="arqueia-skip-link" href="#conteudo-principal">Ir para o conteúdo</a>

      <aside className="arqueia-lab-rail" aria-label="Laboratórios">
        <a className="arqueia-brand-mark" href="/" aria-label={appName}>
          {activeLaboratory?.logoSrc ? (
            <img alt="" className="arqueia-brand-logo" height={46} src={activeLaboratory.logoSrc} width={46} />
          ) : (
            <ArqueiaIcon name="laboratorio" size={26} />
          )}
        </a>
        <nav className="arqueia-lab-list">
          {laboratories.map((laboratory) => (
            <a
              aria-current={laboratory.id === activeLaboratoryId ? 'page' : undefined}
              aria-label={laboratory.name}
              className="arqueia-lab-link"
              href={laboratory.href}
              key={laboratory.id}
              title={laboratory.name}
            >
              {laboratory.logoSrc ? (
                <img alt="" className="arqueia-lab-logo" height={42} src={laboratory.logoSrc} width={42} />
              ) : laboratory.shortName}
            </a>
          ))}
        </nav>
        <button className="arqueia-rail-button" type="button" aria-label="Configurações">
          <ArqueiaIcon name="configuracoes" size={19} />
        </button>
      </aside>

      <aside className="arqueia-module-sidebar">
        <div className="arqueia-sidebar-heading">
          <span className="arqueia-overline">Espaço de trabalho</span>
          <strong>{currentContext}</strong>
        </div>
        <nav aria-label="Módulos" className="arqueia-module-list">
          {moduleNavigation.map((item) => (
            <NavigationLink activeHref={activeModuleHref} item={item} key={item.href} />
          ))}
        </nav>
        <div className="arqueia-sidebar-footer">
          <span aria-hidden="true" className="arqueia-online-dot" />
          Serviços operacionais
        </div>
      </aside>

      <div className="arqueia-main-column">
        <header className="arqueia-topbar">
          <div className="arqueia-mobile-brand">
            <span className="arqueia-mobile-brand-mark">
              {activeLaboratory?.logoSrc ? (
                <img alt="" className="arqueia-lab-logo" height={38} src={activeLaboratory.logoSrc} width={38} />
              ) : (
                <ArqueiaIcon name="laboratorio" size={20} />
              )}
            </span>
            <span><strong>{appName}</strong><small>{currentContext}</small></span>
          </div>
          <button className="arqueia-alert-button" type="button" aria-label="Notificações">
            <ArqueiaIcon name="alerta" size={20} />
            <span className="arqueia-notification-dot" />
          </button>
          <details className="arqueia-user-menu">
            <summary className="arqueia-profile" aria-label={`Abrir menu de ${userLabel}`}>
              <span>{userInitials}</span>
              <span className="arqueia-profile-name">{userLabel}</span>
              <span aria-hidden="true" className="arqueia-profile-chevron">⌄</span>
            </summary>
            <div className="arqueia-user-dropdown" role="menu">
              <a href="/guia" role="menuitem"><ArqueiaIcon name="guia" size={16} /><span>Guia de Uso</span></a>
              <a href="/perfil" role="menuitem"><ArqueiaIcon name="usuarios" size={16} /><span>Perfil</span></a>
              {userMenu}
            </div>
          </details>

        </header>

        <div className="arqueia-content-grid">
          <main className="arqueia-main" id="conteudo-principal">
            <div className="arqueia-page-heading">
              <span className="arqueia-overline">{currentContext}</span>
              <h1>{sectionLabel}</h1>
            </div>
            {children}
          </main>
          {contextualPanel ? (
            <aside className="arqueia-context-panel" aria-label="Painel contextual">
              {contextualPanel}
            </aside>
          ) : null}
        </div>
      </div>

      <nav aria-label="Navegação principal" className="arqueia-mobile-nav">
        {mobileBeforeQr.map((item) => (
          <NavigationLink activeHref={activeModuleHref} compact item={item} key={item.href} />
        ))}
        <a className="arqueia-qr-action" href={qrAction.href} aria-label={qrAction.label}>
          <ArqueiaIcon name="qr" size={25} />
          <span>QR</span>
        </a>
        {mobileAfterQr.map((item) => (
          <NavigationLink activeHref={activeModuleHref} compact item={item} key={item.href} />
        ))}
      </nav>
    </div>
  );
}
