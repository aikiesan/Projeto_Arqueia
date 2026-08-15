'use client';

import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell, type NavigationItem } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { LogoutButton } from '../logout-button';
import { createWorkspacePresentation } from '../presentation';

interface PageData {
  readonly principal: AuthenticatedPrincipal;
  readonly laboratories: readonly Laboratory[];
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar as opções.');
  }
  return response.json() as Promise<T>;
}

function pathnameOf(href: string): string {
  return href.split(/[?#]/, 1)[0] || '/';
}

function navigationCard(item: NavigationItem) {
  return (
    <a className="more-module-card" href={item.href} key={item.href}>
      <span className="more-module-icon">
        <ArqueiaIcon name={item.icon} size={23} />
      </span>
      <span className="more-module-copy">
        <strong>{item.label}</strong>
        <small>{item.description ?? 'Abrir módulo'}</small>
      </span>
      <span aria-hidden="true" className="more-module-chevron">
        ›
      </span>
    </a>
  );
}

export function MorePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLaboratoryId = searchParams?.get('laboratory') ?? '';
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        if (!active) return;
        if (laboratories.length === 0) throw new Error('Nenhum laboratório disponível.');
        setPageData({ principal: session.principal, laboratories });
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof Error && loadError.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar as opções.');
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey, router]);

  const activeLaboratory = useMemo(
    () =>
      pageData?.laboratories.find(({ id }) => id === requestedLaboratoryId) ??
      pageData?.laboratories[0] ??
      null,
    [pageData, requestedLaboratoryId],
  );

  const presentation = useMemo(
    () =>
      pageData && activeLaboratory
        ? createWorkspacePresentation(
            pageData.principal,
            pageData.laboratories,
            activeLaboratory.id,
          )
        : null,
    [activeLaboratory, pageData],
  );

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} type="button">
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <span className="loading-pulse" />
            Carregando opções do seu laboratório...
          </>
        )}
      </main>
    );
  }

  const additionalModules = presentation.moduleNavigation.filter(
    ({ href }) => !['/', '/agenda', '/estoque'].includes(pathnameOf(href)),
  );
  const laboratoryRail = pageData.laboratories.map((laboratory) => ({
    href: `/mais?laboratory=${laboratory.id}`,
    id: laboratory.id,
    ...(laboratory.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: laboratory.name,
    shortName: laboratory.code.slice(0, 2).toUpperCase(),
  }));
  const qrHref = `/qr?laboratory=${activeLaboratory.id}`;

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/mais"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: qrHref, label: 'Ler QR Code' }}
      sectionLabel="Mais opções"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.name}
      userMenu={<LogoutButton />}
    >
      <section className="more-hub-intro">
        <span className="section-kicker">Acesso rápido</span>
        <h2>Tudo o que você precisa, sem procurar em menus</h2>
        <p>Abra módulos, troque o laboratório ativo ou acesse sua conta.</p>
      </section>

      <section aria-labelledby="more-modules-title" className="more-hub-section">
        <div className="more-section-heading">
          <div>
            <span className="section-kicker">Ferramentas</span>
            <h2 id="more-modules-title">Outros módulos</h2>
          </div>
          <span>{additionalModules.length} disponíveis</span>
        </div>
        <div className="more-module-grid">{additionalModules.map(navigationCard)}</div>
      </section>

      <section aria-labelledby="more-labs-title" className="more-hub-section">
        <div className="more-section-heading">
          <div>
            <span className="section-kicker">Contexto</span>
            <h2 id="more-labs-title">Laboratório ativo</h2>
          </div>
        </div>
        <div className="more-laboratory-list">
          {pageData.laboratories.map((laboratory) => {
            const isActive = laboratory.id === activeLaboratory.id;
            return (
              <a
                aria-current={isActive ? 'page' : undefined}
                className="more-laboratory-card"
                href={`/mais?laboratory=${laboratory.id}`}
                key={laboratory.id}
              >
                <span className="more-laboratory-mark">
                  {laboratory.code.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{laboratory.name}</strong>
                  <small>{isActive ? 'Em uso agora' : 'Trocar contexto'}</small>
                </span>
                {isActive ? <span className="more-active-label">Ativo</span> : null}
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="more-account-title" className="more-hub-section more-account-section">
        <div className="more-section-heading">
          <div>
            <span className="section-kicker">Conta</span>
            <h2 id="more-account-title">Seu acesso</h2>
          </div>
        </div>
        <div className="more-account-actions">
          <a className="more-module-card" href="/perfil">
            <span className="more-module-icon">
              <ArqueiaIcon name="usuarios" size={23} />
            </span>
            <span className="more-module-copy">
              <strong>Perfil</strong>
              <small>Dados pessoais e sessões</small>
            </span>
            <span aria-hidden="true" className="more-module-chevron">›</span>
          </a>
          <LogoutButton />
        </div>
      </section>
    </WorkspaceShell>
  );
}
