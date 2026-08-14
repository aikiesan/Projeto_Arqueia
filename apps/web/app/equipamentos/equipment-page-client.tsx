'use client';

import {
  createEquipmentInputSchema,
  updateEquipmentInputSchema,
  type AuthenticatedPrincipal,
  type CatalogOption,
  type CatalogOptionPage,
  type Equipment,
  type EquipmentPage,
  type EquipmentStatus,
  type Laboratory,
} from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { LogoutButton } from '../logout-button';
import { useInteractionFeedback } from '../interaction-feedback';
import { principalCan } from '../lib/permissions';
import { createWorkspacePresentation } from '../presentation';
import { EquipmentFormDialog, type EquipmentFormValue } from './equipment-form-dialog';

const statusLabels: Readonly<Record<EquipmentStatus, string>> = {
  AVAILABLE: 'Disponível', UNDER_EVALUATION: 'Em avaliação', UNAVAILABLE: 'Indisponível', MAINTENANCE: 'Em manutenção',
};

interface PageData { readonly principal: AuthenticatedPrincipal; readonly laboratories: readonly Laboratory[] }
interface CatalogData { readonly models: readonly CatalogOption[]; readonly spaces: readonly CatalogOption[]; readonly benches: readonly CatalogOption[] }

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new Error(body?.message ?? (response.status === 403 ? 'Você não possui permissão para esta ação.' : 'Não foi possível concluir a operação.'));
  }
  return response.json() as Promise<T>;
}

async function loadAllCatalogOptions(laboratoryId: string, kind: string): Promise<readonly CatalogOption[]> {
  const items: CatalogOption[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ laboratoryId, kind, limit: '50' });
    if (cursor) query.set('cursor', cursor);
    const result = await readJson<CatalogOptionPage>(`/api/catalog/options?${query}`);
    items.push(...result.items);
    if (!result.pageInfo.hasNextPage || !result.pageInfo.nextCursor) return items;
    cursor = result.pageInfo.nextCursor;
  }
  throw new Error('O catálogo excedeu o limite seguro de leitura.');
}

export function EquipmentPageClient() {
  const router = useRouter();
  const { notify } = useInteractionFeedback();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<readonly Equipment[]>([]);
  const [pageInfo, setPageInfo] = useState<EquipmentPage['pageInfo']>({ hasNextPage: false, nextCursor: null });
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [catalog, setCatalog] = useState<CatalogData>({ models: [], spaces: [], benches: [] });
  const [status, setStatus] = useState<EquipmentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formEquipment, setFormEquipment] = useState<Equipment | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEquipment = useCallback(async (nextLaboratoryId: string, cursor: string | null, nextStatus: EquipmentStatus | '', nextSearch: string) => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ laboratoryId: nextLaboratoryId, limit: '12' });
      if (cursor) query.set('cursor', cursor);
      if (nextStatus) query.set('status', nextStatus);
      if (nextSearch) query.set('search', nextSearch);
      const result = await readJson<EquipmentPage>(`/api/equipment?${query}`);
      setEquipment(result.items); setPageInfo(result.pageInfo);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === 'UNAUTHENTICATED') { router.replace('/login'); return; }
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar equipamentos.');
    } finally { setLoading(false); }
  }, [router]);

  const loadLaboratory = useCallback(async (nextLaboratoryId: string) => {
    setLoading(true); setError(null);
    try {
      const [models, spaces, benches] = await Promise.all([
        loadAllCatalogOptions(nextLaboratoryId, 'EQUIPMENT_MODEL'),
        loadAllCatalogOptions(nextLaboratoryId, 'SPACE'),
        loadAllCatalogOptions(nextLaboratoryId, 'BENCH'),
      ]);
      setCatalog({ models, spaces, benches });
      setCursorHistory([null]); setStatus(''); setSearch(''); setAppliedSearch('');
      await loadEquipment(nextLaboratoryId, null, '', '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao iniciar o cadastro.'); setLoading(false);
    }
  }, [loadEquipment]);

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'), readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        const requestedId = new URLSearchParams(window.location.search).get('laboratory');
        const preferred = laboratories.find(({ id }) => id === requestedId) ?? laboratories.find(({ code }) => code === 'CP2b') ?? laboratories[0];
        if (!preferred) throw new Error('Nenhum laboratório disponível para esta conta.');
        setPageData({ principal: session.principal, laboratories }); setLaboratoryId(preferred.id);
        await loadLaboratory(preferred.id);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === 'UNAUTHENTICATED') { router.replace('/login'); return; }
        setError(loadError instanceof Error ? loadError.message : 'Falha ao iniciar a página.'); setLoading(false);
      }
    })();
  }, [loadLaboratory, router]);

  const activeLaboratory = pageData?.laboratories.find(({ id }) => id === laboratoryId) ?? null;
  const presentation = useMemo(() => pageData && laboratoryId ? createWorkspacePresentation(pageData.principal, pageData.laboratories, laboratoryId) : null, [laboratoryId, pageData]);
  const canManage = pageData ? principalCan(pageData.principal, 'equipment.manage') : false;
  const optionLabel = (id: string | null, options: readonly CatalogOption[]) => id ? options.find((option) => option.id === id)?.label ?? 'Referência cadastrada' : 'Não informado';

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!laboratoryId) return;
    const normalized = search.trim();
    if (normalized.length === 1) { setError('Digite pelo menos 2 caracteres para buscar.'); return; }
    setAppliedSearch(normalized); setCursorHistory([null]);
    await loadEquipment(laboratoryId, null, status, normalized);
  }

  async function saveEquipment(value: EquipmentFormValue) {
    if (!laboratoryId) return;
    setPending(true); setError(null);
    try {
      if (formEquipment) {
        const { laboratoryId: _laboratoryId, ...update } = value;
        void _laboratoryId;
        const parsed = updateEquipmentInputSchema.safeParse(update);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revise os campos informados.');
        await readJson<Equipment>(`/api/equipment/${formEquipment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      } else {
        const parsed = createEquipmentInputSchema.safeParse(value);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revise os campos informados.');
        await readJson<Equipment>('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      }
      setFormEquipment(undefined); setCursorHistory([null]);
      await loadEquipment(laboratoryId, null, status, appliedSearch);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar equipamento.'); }
    finally { setPending(false); }
  }

  async function updateStatusInline(item: Equipment, nextStatus: EquipmentStatus) {
    if (nextStatus === item.status || statusPendingId) return;
    setStatusPendingId(item.id);
    setError(null);
    setEquipment((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: nextStatus } : candidate));
    try {
      const parsed = updateEquipmentInputSchema.parse({ status: nextStatus });
      const saved = await readJson<Equipment>(`/api/equipment/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      setEquipment((current) => current.map((candidate) => candidate.id === saved.id ? saved : candidate));
      notify(`${item.name}: status atualizado para ${statusLabels[saved.status]}.`, 'success');
    } catch (statusError) {
      setEquipment((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
      const message = statusError instanceof Error ? statusError.message : 'Falha ao atualizar o status.';
      setError(message);
      notify(`Não foi possível atualizar ${item.name}.`, 'error');
    } finally {
      setStatusPendingId(null);
    }
  }

  if (!pageData || !activeLaboratory || !presentation) return <main className="standalone-loading"><span className="loading-pulse" />{error ?? 'Carregando espaço seguro…'}</main>;

  return (
    <WorkspaceShell {...presentation} activeModuleHref="/equipamentos" appName="Arqueia" currentContext={activeLaboratory.name} qrAction={{ href: '/qr', label: 'Ler QR Code' }} sectionLabel="Equipamentos" userLabel={presentation.currentUser.name} userMenu={<LogoutButton />}>
      <section className="equipment-toolbar"><div><span className="section-kicker">Cadastro operacional</span><h2>Equipamentos do {activeLaboratory.code}</h2><p>Localize, cadastre e mantenha os dados usados pela agenda e pela gestão do laboratório.</p></div>{canManage ? <button className="primary-button" onClick={() => setFormEquipment(null)} type="button"><ArqueiaIcon name="mais" size={18} /> Cadastrar equipamento</button> : null}</section>

      <form className="equipment-filters" onSubmit={applyFilters} role="search">
        <label><span className="sr-only">Buscar equipamentos</span><input maxLength={80} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou código…" value={search} /></label>
        <select aria-label="Filtrar por status" onChange={(event) => setStatus(event.target.value as EquipmentStatus | '')} value={status}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="secondary-button" type="submit">Buscar</button>
      </form>

      {error ? <p aria-live="polite" className="form-error equipment-error">{error}</p> : null}
      {loading ? <div className="equipment-empty"><span className="loading-pulse" /><h3>Carregando equipamentos…</h3></div> : equipment.length === 0 ? (
        <div className="equipment-empty"><span className="equipment-empty-icon"><ArqueiaIcon name="equipamentos" size={30} /></span><h3>{appliedSearch || status ? 'Nenhum resultado encontrado' : 'Nenhum equipamento cadastrado'}</h3><p>{appliedSearch || status ? 'Ajuste os filtros e tente novamente.' : 'Use o catálogo CP2b para confirmar o primeiro ativo físico.'}</p>{canManage && !appliedSearch && !status ? <button className="secondary-button" onClick={() => setFormEquipment(null)} type="button">Cadastrar o primeiro</button> : null}</div>
      ) : (
        <><div className="equipment-grid">{equipment.map((item) => (
          <article className="equipment-card" key={item.id}><div className="equipment-card-heading"><span className={`status-dot status-dot--${item.status.toLowerCase()}`} />{canManage ? <label className="equipment-inline-status"><span className="sr-only">Status de {item.name}</span><select aria-label={`Status de ${item.name}`} disabled={statusPendingId === item.id} onChange={(event) => void updateStatusInline(item, event.target.value as EquipmentStatus)} value={item.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{statusPendingId === item.id ? <small role="status">Salvando…</small> : null}</label> : <span>{statusLabels[item.status]}</span>}{canManage ? <button aria-label={`Editar ${item.name}`} onClick={() => setFormEquipment(item)} type="button">Editar</button> : null}</div><h3>{item.name}</h3><code>{item.code}</code><dl><div><dt>Modelo</dt><dd>{optionLabel(item.catalogOptionId, catalog.models)}</dd></div><div><dt>Local</dt><dd>{optionLabel(item.spaceOptionId, catalog.spaces)}</dd></div><div><dt>Patrimônio</dt><dd>{item.assetTag ?? 'Não informado'}</dd></div><div><dt>Série</dt><dd>{item.serialNumber ?? 'Não informada'}</dd></div><div><dt>Reserva máxima</dt><dd>{item.reservationPolicy.maxReservationMinutes} min</dd></div><div><dt>Treinamento</dt><dd>{item.reservationPolicy.requiresTraining ? 'Obrigatório' : 'Não exigido'}</dd></div></dl>{item.notes ? <p className="equipment-card-notes">{item.notes}</p> : null}<a className="equipment-reserve-link" href={`/agenda?equipmentId=${item.id}`}>Reservar</a></article>
        ))}</div><nav aria-label="Paginação de equipamentos" className="equipment-pagination"><button className="secondary-button" disabled={cursorHistory.length === 1} onClick={() => { const next = cursorHistory.slice(0, -1); setCursorHistory(next); void loadEquipment(activeLaboratory.id, next.at(-1) ?? null, status, appliedSearch); }} type="button">Anterior</button><span>Página {cursorHistory.length}</span><button className="secondary-button" disabled={!pageInfo.hasNextPage || !pageInfo.nextCursor} onClick={() => { if (!pageInfo.nextCursor) return; const next = [...cursorHistory, pageInfo.nextCursor]; setCursorHistory(next); void loadEquipment(activeLaboratory.id, pageInfo.nextCursor, status, appliedSearch); }} type="button">Próxima</button></nav></>
      )}
      {formEquipment !== undefined ? <EquipmentFormDialog catalog={catalog} equipment={formEquipment} laboratoryId={activeLaboratory.id} onClose={() => setFormEquipment(undefined)} onSave={saveEquipment} pending={pending} /> : null}
    </WorkspaceShell>
  );
}
