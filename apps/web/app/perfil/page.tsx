import { WorkspaceShell } from '@arqueia/ui';
import { redirect } from 'next/navigation';

import { LogoutButton } from '../logout-button';
import { loadLaboratories, loadPrincipal } from '../lib/session';
import { createWorkspacePresentation } from '../presentation';

const providerLabels = { LOCAL: 'Conta local', OIDC: 'Acesso institucional', HYBRID: 'Local e institucional' } as const;

export default async function ProfilePage() {
  const principal = await loadPrincipal();
  if (principal === null) redirect('/login');
  const laboratories = await loadLaboratories();
  const presentation = createWorkspacePresentation(principal, laboratories);

  return (
    <WorkspaceShell
      activeLaboratoryId={presentation.activeLaboratoryId}
      activeModuleHref=""
      appName="Arqueia"
      currentContext={presentation.currentContext}
      laboratories={presentation.laboratories}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Meu perfil"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.name}
      userMenu={<LogoutButton />}
    >
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden="true">{presentation.userInitials}</div>
        <div><span className="section-kicker">Conta Arqueia</span><h2>{principal.user.name}</h2><p>{principal.user.email}</p></div>
      </section>
      <section className="profile-details">
        <div><span>Tipo de acesso</span><strong>{providerLabels[principal.user.identityProvider]}</strong></div>
        <div><span>Status</span><strong>{principal.user.status === 'ACTIVE' ? 'Ativo' : principal.user.status}</strong></div>
        <div><span>Laboratórios</span><strong>{principal.memberships.filter(({ archivedAt }) => archivedAt === null).length}</strong></div>
        <div><span>Funções do sistema</span><strong>{principal.systemRoles.filter(({ archivedAt }) => archivedAt === null).map(({ role }) => role).join(', ') || 'Nenhuma'}</strong></div>
      </section>
    </WorkspaceShell>
  );
}
