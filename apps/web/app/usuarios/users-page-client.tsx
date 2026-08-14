'use client';

import type {
  AuthenticatedPrincipal,
  Laboratory,
  LaboratoryRole,
  UserAccessSnapshot,
  User,
  UserStatus,
} from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { createWorkspacePresentation } from '../presentation';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

const roleLabels: Record<LaboratoryRole, string> = {
  TECNICO: 'Técnico de Laboratório',
  USUARIO: 'Usuário Pesquisador',
  RESPONSAVEL_CONTROLADOS: 'Responsável por Controlados',
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: 'Ativo',
  INVITED: 'Convidado',
  SUSPENDED: 'Suspenso',
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    if (response.status === 401 && body?.code === 'INVALID_CREDENTIALS') {
      throw new Error('Senha de confirmação incorreta.');
    }
    if (response.status === 401) throw new Error('UNAUTHENTICATED');
    if (body?.code === 'UNAUTHORIZED' || body?.code === 'FORBIDDEN') {
      throw new Error('Acesso negado: Requer privilégios de Administrador.');
    }
    throw new Error(body?.message ?? 'Não foi possível concluir a operação.');
  }
  return response.json() as Promise<T>;
}

export function UsersPageClient() {
  const router = useRouter();

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [users, setUsers] = useState<readonly User[]>([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [editUserModal, setEditUserModal] = useState<User | null>(null);
  const [accessModalUser, setAccessModalUser] = useState<User | null>(null);

  // Access Modal state
  const [selectedRole, setSelectedRole] = useState<LaboratoryRole>('USUARIO');
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [confirmationPassword, setConfirmationPassword] = useState('');
  const [currentAccess, setCurrentAccess] = useState<UserAccessSnapshot | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userList = await readJson<readonly User[]>('/api/users');
      setUsers(userList);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        const preferred = laboratories.find((lab) => lab.code === 'CP2b') ?? laboratories[0];
        if (!preferred) throw new Error('Nenhum laboratório disponível.');

        setPageData({ principal: session.principal, laboratories });
        setLaboratoryId(preferred.id);

        await loadData();
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao inicializar usuários.');
        setLoading(false);
      }
    })();
  }, [router]);

  const activeLaboratory = useMemo(
    () => pageData?.laboratories.find((lab) => lab.id === laboratoryId) ?? null,
    [laboratoryId, pageData],
  );

  const presentation = useMemo(
    () => (pageData === null ? null : createWorkspacePresentation(pageData.principal, pageData.laboratories)),
    [pageData],
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pageData) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const tempPass = String(form.get('temporaryPassword') ?? '').trim();

    try {
      await readJson('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: pageData.principal.user.institutionId,
          name: form.get('name'),
          email: form.get('email'),
          temporaryPassword: tempPass || undefined,
        }),
      });

      setNewUserModalOpen(false);
      setNotice('✅ Usuário criado com sucesso no sistema!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuário.');
    } finally {
      setPending(false);
    }
  };

  const handleUpdateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editUserModal) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson(`/api/users/${editUserModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          status: form.get('status'),
        }),
      });

      setEditUserModal(null);
      setNotice('✅ Dados e status do usuário atualizados!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar usuário.');
    } finally {
      setPending(false);
    }
  };

  const handleAssignAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessModalUser || !laboratoryId) return;
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      if (isSystemAdmin) {
        await readJson('/api/access/system-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: accessModalUser.id,
            role: 'ADMIN',
            confirmationPassword,
          }),
        });
      } else {
        await readJson('/api/access/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: accessModalUser.id,
            laboratoryId,
            role: selectedRole,
            confirmationPassword,
          }),
        });
      }

      setConfirmationPassword('');
      setCurrentAccess(await readJson<UserAccessSnapshot>(`/api/access?userId=${accessModalUser.id}`));
      setNotice('✅ Permissões de acesso atualizadas com sucesso!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar permissões. Verifique sua senha.');
    } finally {
      setPending(false);
    }
  };

  const openAccessModal = async (user: User) => {
    setAccessModalUser(user);
    setConfirmationPassword('');
    setCurrentAccess(null);
    setAccessLoading(true);
    setError(null);
    try {
      setCurrentAccess(await readJson<UserAccessSnapshot>(`/api/access?userId=${user.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar permissões.');
    } finally {
      setAccessLoading(false);
    }
  };

  const revokeAccess = async (kind: 'membership' | 'system-role', id: string) => {
    if (!accessModalUser || !confirmationPassword) return;
    setPending(true);
    setError(null);
    try {
      const path = kind === 'membership'
        ? `/api/access/memberships/${id}`
        : `/api/access/system-roles/${id}`;
      await readJson(path, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationPassword }),
      });
      setConfirmationPassword('');
      setCurrentAccess(await readJson<UserAccessSnapshot>(`/api/access?userId=${accessModalUser.id}`));
      setNotice('Acesso revogado e registrado na auditoria.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar acesso.');
    } finally {
      setPending(false);
    }
  };

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        {error ?? 'Carregando equipe e acessos...'}
      </main>
    );
  }

  const userInitials = pageData.principal.user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/usuarios?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/usuarios"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Gestão de Usuários"
      userInitials={userInitials}
      userLabel={pageData.principal.user.name}
    >
      <section className="equipment-toolbar">
        <div>
          <span className="section-kicker">{activeLaboratory.name}</span>
          <h2>Equipe & Controle de Acessos</h2>
          <p>Gerencie pesquisadores, técnicos de laboratório e administradores do CP2b.</p>
        </div>
        <div>
          <button className="primary-button" onClick={() => setNewUserModalOpen(true)} type="button">
            <ArqueiaIcon name="mais" size={18} /> Novo Usuário
          </button>
        </div>
      </section>

      {notice && (
        <div style={{ background: '#e6fffa', border: '1px solid #38b2ac', color: '#234e52', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.5rem 0' }}>
          {notice}
        </div>
      )}

      {error && <p aria-live="polite" className="form-error equipment-error">{error}</p>}

      {/* Search Bar */}
      <section className="agenda-control-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1rem 0' }}>
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', minWidth: '300px' }}
        />
        <span style={{ fontSize: '0.85rem', color: '#718096', fontWeight: 600 }}>
          {filteredUsers.length} usuário(s) encontrado(s)
        </span>
      </section>

      {/* User Grid / Cards */}
      {loading ? (
        <div className="equipment-empty">
          <span className="loading-pulse" />
          <h3>Carregando lista de usuários...</h3>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="equipment-empty">
          <span className="equipment-empty-icon"><ArqueiaIcon name="usuarios" size={30} /></span>
          <h3>Nenhum usuário encontrado</h3>
          <p>Ajuste os termos de busca ou cadastre um novo usuário no sistema.</p>
        </div>
      ) : (
        <div className="equipment-grid">
          {filteredUsers.map((u) => {
            const isSelf = u.id === pageData.principal.user.id;
            const isSuspended = u.status === 'SUSPENDED';

            return (
              <article className="equipment-card" key={u.id} style={{ opacity: isSuspended ? 0.65 : 1 }}>
                <div className="equipment-card-heading">
                  <span className={`status-dot status-dot--${u.status === 'ACTIVE' ? 'available' : 'unavailable'}`} />
                  <span>{statusLabels[u.status]}</span>
                  {isSelf && <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>Você</span>}
                </div>
                <h3>{u.name}</h3>
                <code>{u.email}</code>

                <dl style={{ marginTop: '0.5rem' }}>
                  <div>
                    <dt>Provedor</dt>
                    <dd>{u.identityProvider === 'LOCAL' ? 'Senha Local' : 'SSO Unicamp'}</dd>
                  </div>
                  <div>
                    <dt>Cadastrado em</dt>
                    <dd>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</dd>
                  </div>
                </dl>

                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #edf2f7', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    className="secondary-button"
                    onClick={() => setEditUserModal(u)}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    type="button"
                  >
                    Editar Status
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => void openAccessModal(u)}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    type="button"
                  >
                    Permissões & Papéis
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Novo Usuário */}
      {newUserModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="new-user-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Controle de Acessos</span>
                <h2 id="new-user-title">Cadastrar Novo Usuário</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setNewUserModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateUser}>
              <label className="field-wide">
                <span>Nome Completo *</span>
                <input name="name" placeholder="Ex: Dra. Mariana Silva" required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>E-mail Institucional *</span>
                <input type="email" name="email" placeholder="mariana@unicamp.br" required maxLength={254} />
              </label>

              <label className="field-wide">
                <span>Senha Provisória (Opcional)</span>
                <input
                  type="password"
                  name="temporaryPassword"
                  placeholder="Sem senha, o acesso permanecerá pendente"
                  minLength={12}
                  maxLength={128}
                />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setNewUserModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Cadastrando...' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Editar Status Usuário */}
      {editUserModal && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="edit-user-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Perfil de Usuário</span>
                <h2 id="edit-user-title">Editar Dados do Usuário</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setEditUserModal(null)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleUpdateStatus}>
              <label className="field-wide">
                <span>Nome Completo *</span>
                <input name="name" defaultValue={editUserModal.name} required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>Status da Conta *</span>
                <select name="status" defaultValue={editUserModal.status} required>
                  {(Object.keys(statusLabels) as UserStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {statusLabels[st]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setEditUserModal(null)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Gerenciar Permissões */}
      {accessModalUser && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="access-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Controle de Permissões RBAC</span>
                <h2 id="access-title">Gerenciar Papéis de {accessModalUser.name}</h2>
              </div>
              <button aria-label="Fechar" onClick={() => {
                setAccessModalUser(null);
                setConfirmationPassword('');
              }} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleAssignAccess}>
              <fieldset style={{ border: '1px solid #cbd5e0', padding: '0.75rem', borderRadius: '6px' }}>
                <legend style={{ fontWeight: 600, fontSize: '0.85rem' }}>Tipo de Papel</legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="radio"
                    name="accessType"
                    checked={!isSystemAdmin}
                    onChange={() => setIsSystemAdmin(false)}
                  />
                  <span>Papel Operacional no Laboratório CP2b</span>
                </label>

                {!isSystemAdmin && (
                  <label style={{ marginLeft: '1.5rem', display: 'block' }}>
                    <span>Papel no Laboratório *</span>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as LaboratoryRole)}
                    >
                      {(Object.keys(roleLabels) as LaboratoryRole[]).map((r) => (
                        <option key={r} value={r}>
                          {roleLabels[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input
                    type="radio"
                    name="accessType"
                    checked={isSystemAdmin}
                    onChange={() => setIsSystemAdmin(true)}
                  />
                  <span>Administrador Global do Sistema (ADMIN)</span>
                </label>
              </fieldset>

              <section aria-label="Acessos atuais" className="user-access-current">
                <header>
                  <strong>Acessos atuais</strong>
                  <span>Somente atribuições ativas</span>
                </header>
                {accessLoading ? (
                  <p>Carregando acessos...</p>
                ) : currentAccess !== null
                  && currentAccess.memberships.length === 0
                  && currentAccess.systemRoles.length === 0 ? (
                    <p>Nenhum papel atribuído.</p>
                  ) : (
                    <ul>
                      {currentAccess?.memberships.map((membership) => {
                        const laboratory = pageData.laboratories.find(
                          (item) => item.id === membership.laboratoryId,
                        );
                        return (
                          <li key={membership.id}>
                            <span>
                              <strong>{roleLabels[membership.role]}</strong>
                              <small>{laboratory?.name ?? 'Laboratório'}</small>
                            </span>
                            <button
                              className="secondary-button"
                              disabled={pending || !confirmationPassword}
                              onClick={() => void revokeAccess('membership', membership.id)}
                              type="button"
                            >
                              Revogar
                            </button>
                          </li>
                        );
                      })}
                      {currentAccess?.systemRoles.map((assignment) => (
                        <li key={assignment.id}>
                          <span>
                            <strong>Administrador global</strong>
                            <small>Sistema Arqueia</small>
                          </span>
                          <button
                            className="secondary-button"
                            disabled={pending || !confirmationPassword}
                            onClick={() => void revokeAccess('system-role', assignment.id)}
                            type="button"
                          >
                            Revogar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>

              <label className="field-wide" style={{ background: '#fff5f5', border: '1px solid #feb2b2', padding: '0.75rem', borderRadius: '6px' }}>
                <span style={{ color: '#9b2c2c', fontWeight: 600 }}>Sua Senha de Confirmação (Segurança) *</span>
                <input
                  type="password"
                  value={confirmationPassword}
                  onChange={(e) => setConfirmationPassword(e.target.value)}
                  placeholder="Confirme sua senha de administrador para autorizar esta alteração"
                  required
                />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => {
                  setAccessModalUser(null);
                  setConfirmationPassword('');
                }} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending || !confirmationPassword} type="submit">
                  {pending ? 'Atribuindo...' : 'Confirmar e Atribuir Papel'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
