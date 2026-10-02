'use client';

import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { GoodPracticesGuide } from '../components/good-practices/good-practices-guide';
import { WorkspaceNotifications } from '../components/notifications/workspace-notifications';
import { BASE_PATH, withBasePath } from '../lib/base-path';
import { LogoutButton } from '../logout-button';
import { createWorkspacePresentation } from '../presentation';

interface PageData {
  readonly principal: AuthenticatedPrincipal;
  readonly laboratories: readonly Laboratory[];
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(withBasePath(url), { cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar a página.');
  }
  return response.json() as Promise<T>;
}

/**
 * Boas práticas de laboratório dentro do app, como item do menu lateral. O
 * conteúdo é o mesmo da página pública `/boas-praticas`; aqui ele ganha o shell
 * e o "Avisar a coordenação" já vai para o laboratório ativo.
 */
export function SafetyPageClient() {
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
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a página.');
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
        ? createWorkspacePresentation(pageData.principal, pageData.laboratories, activeLaboratory.id)
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
            Carregando boas práticas...
          </>
        )}
      </main>
    );
  }

  const laboratoryRail = pageData.laboratories.map((laboratory) => ({
    href: `/seguranca?laboratory=${laboratory.id}`,
    id: laboratory.id,
    ...(laboratory.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: laboratory.name,
    shortName: laboratory.code.slice(0, 2).toUpperCase(),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/seguranca"
      appName="Arqueia"
      basePath={BASE_PATH}
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      notifications={<WorkspaceNotifications scope={presentation.notificationScope} />}
      reportAction={presentation.reportAction}
      qrAction={{ href: `/qr?laboratory=${activeLaboratory.id}`, label: 'Ler QR Code' }}
      sectionLabel="Boas Práticas de Laboratório"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.name}
      userMenu={<LogoutButton />}
    >
      <section className="gp-page-intro">
        <span className="section-kicker">Segurança no laboratório</span>
        <h2>O que fazer antes, durante e em caso de acidente</h2>
        <p>
          Leia antes do primeiro uso e volte aqui sempre que tiver dúvida. O mesmo conteúdo fica aberto,
          sem login, em <a href={withBasePath('/boas-praticas')}>Boas práticas (página pública)</a>: compartilhe
          com quem ainda não tem conta.
        </p>
      </section>
      <GoodPracticesGuide headingLevel={3} reportHref={presentation.reportAction.href} />
    </WorkspaceShell>
  );
}
