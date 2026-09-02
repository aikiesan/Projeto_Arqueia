import { WorkspaceShell } from '@arqueia/ui';
import { redirect } from 'next/navigation';

import { LogoutButton } from '../logout-button';
import { loadLaboratories, loadPrincipal } from '../lib/session';
import { createWorkspacePresentation } from '../presentation';
import { ProfileSecurityClient } from './profile-security-client';

const categoryLabels = {
  IC: 'Iniciação científica',
  MESTRADO: 'Mestrado',
  DOUTORADO: 'Doutorado',
  POS_DOUTORADO: 'Pós-doutorado',
  PESQUISADOR: 'Pesquisador',
} as const;

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
      qrAction={{
        href: presentation.activeLaboratoryId ? `/qr?laboratory=${presentation.activeLaboratoryId}` : '/qr',
        label: 'Ler QR Code',
      }}
      sectionLabel="Meu perfil"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.loginCode}
      userMenu={<LogoutButton />}
    >
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden="true">{presentation.userInitials}</div>
        <div><span className="section-kicker">Conta Arqueia</span><h2>{principal.user.loginCode}</h2><p>Identificador pseudonimizado</p></div>
      </section>
      <section className="profile-details">
        <div><span>Categoria</span><strong>{categoryLabels[principal.user.academicCategory]}</strong></div>
        <div><span>Status</span><strong>{principal.user.status === 'ACTIVE' ? 'Ativo' : principal.user.status}</strong></div>
        <div><span>Laboratórios</span><strong>{principal.memberships.filter(({ archivedAt }) => archivedAt === null).length}</strong></div>
        <div><span>Funções do sistema</span><strong>{principal.systemRoles.filter(({ archivedAt }) => archivedAt === null).map(({ role }) => role).join(', ') || 'Nenhuma'}</strong></div>
      </section>
      <ProfileSecurityClient required={principal.user.mustChangePassword} />
    </WorkspaceShell>
  );
}
