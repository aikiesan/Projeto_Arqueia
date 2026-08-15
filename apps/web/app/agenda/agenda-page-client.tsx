'use client';

import type {
  AuthenticatedPrincipal,
  CreateReservationResult,
  Equipment,
  EquipmentPage,
  Laboratory,
  Project,
  ScheduleCapabilities,
  ScheduleItem,
  ScheduleResponse,
  TechnicalBlockReason,
} from '@arqueia/contracts';

import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  ScheduleDayView,
  ScheduleDetailsDrawer,
  ScheduleHeader,
  ScheduleLegend,
  ScheduleStateFeedback,
  ScheduleWeekView,
  type ScheduleSlotSelection,
} from '../components/scheduling';
import { createWorkspacePresentation } from '../presentation';

type ViewMode = 'DAY' | 'WEEK';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

const blockReasonLabels: Record<TechnicalBlockReason, string> = {
  MAINTENANCE: 'Manutenção Preventiva/Corretiva',
  CALIBRATION: 'Calibração / Ajuste Fino',
  INTERRUPTED_SERVICE: 'Interrupção Técnica de Serviço',
  OTHER: 'Outro Bloqueio Operacional',
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    if (body?.code === 'RESERVATION_SLOT_CONFLICT') {
      throw new Error('CONFLITO: O equipamento já está ocupado no horário selecionado.');
    }
    throw new Error(body?.message ?? 'Não foi possível concluir a operação.');
  }
  return response.json() as Promise<T>;
}

function formatDateIso(date: Date): string {
  return date.toISOString();
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function getRangeForView(date: Date, mode: ViewMode): { startsAt: Date; endsAt: Date } {
  if (mode === 'DAY') {
    return { startsAt: startOfDay(date), endsAt: endOfDay(date) };
  }
  // WEEK
  const day = date.getDay();
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { startsAt: startOfDay(monday), endsAt: endOfDay(sunday) };
}

export function AgendaPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEquipmentId = searchParams?.get('equipmentId') ?? '';
  const urlLaboratoryId = searchParams?.get('laboratory') ?? '';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [equipments, setEquipments] = useState<readonly Equipment[]>([]);
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(urlEquipmentId);
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [onlyMine, setOnlyMine] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<readonly ScheduleItem[]>([]);
  const [timezone, setTimezone] = useState<string>('America/Sao_Paulo');
  const [capabilities, setCapabilities] = useState<ScheduleCapabilities>({
    canReserve: false,
    canManageBlocks: false,
  });

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modais
  const [resModalOpen, setResModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  // Form Defaults for Click-to-Reserve
  const [slotDefaults, setSlotDefaults] = useState<{ date: string; startTime: string; endTime: string }>({
    date: new Date().toISOString().split('T')[0] ?? '',
    startTime: '09:00',
    endTime: '11:00',
  });

  const loadSchedule = useCallback(
    async (labId: string, eqId: string, date: Date, mode: ViewMode, mine: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const { startsAt, endsAt } = getRangeForView(date, mode);
        const query = new URLSearchParams({
          laboratoryId: labId,
          startsAt: formatDateIso(startsAt),
          endsAt: formatDateIso(endsAt),
          onlyMine: mine ? 'true' : 'false',
        });
        if (eqId) {
          query.set('equipmentId', eqId);
        }
        const scheduleRes = await readJson<ScheduleResponse>(`/api/scheduling?${query.toString()}`);
        setScheduleItems(scheduleRes.items);
        setCapabilities(scheduleRes.capabilities);
        if (scheduleRes.timezone) {
          setTimezone(scheduleRes.timezone);
        }
      } catch (loadErr) {
        if (loadErr instanceof Error && loadErr.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(loadErr instanceof Error ? loadErr.message : 'Falha ao carregar a agenda.');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        const preferred = laboratories.find((lab) => lab.id === urlLaboratoryId) ?? laboratories[0];
        if (!preferred) throw new Error('Nenhum laboratório disponível.');

        setPageData({ principal: session.principal, laboratories });
        setLaboratoryId(preferred.id);

        const [eqPage, projList] = await Promise.all([
          readJson<EquipmentPage>(`/api/equipment?${new URLSearchParams({ laboratoryId: preferred.id, limit: '50' })}`),
          readJson<readonly Project[]>('/api/projects'),
        ]);

        setEquipments(eqPage.items);
        setProjects(
          projList.filter(
            (project) => project.laboratoryId === preferred.id && project.status === 'ACTIVE',
          ),
        );

        const activeEqId = urlEquipmentId || '';
        setSelectedEquipmentId(activeEqId);

        await loadSchedule(preferred.id, activeEqId, currentDate, viewMode, onlyMine);
      } catch (initErr) {
        if (initErr instanceof Error && initErr.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(initErr instanceof Error ? initErr.message : 'Falha ao inicializar agenda.');
        setLoading(false);
      }
    })();
  }, [router]);

  const activeLaboratory = useMemo(
    () => pageData?.laboratories.find((lab) => lab.id === laboratoryId) ?? null,
    [laboratoryId, pageData],
  );

  const presentation = useMemo(
    () =>
      pageData === null || laboratoryId === null
        ? null
        : createWorkspacePresentation(
            pageData.principal,
            pageData.laboratories,
            laboratoryId,
          ),
    [laboratoryId, pageData],
  );

  const handleEquipmentChange = (eqId: string) => {
    setSelectedEquipmentId(eqId);
    if (laboratoryId) {
      void loadSchedule(laboratoryId, eqId, currentDate, viewMode, onlyMine);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (laboratoryId) {
      void loadSchedule(laboratoryId, selectedEquipmentId, currentDate, mode, onlyMine);
    }
  };

  const handleDateNavigate = (delta: number) => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'DAY') {
      nextDate.setDate(nextDate.getDate() + delta);
    } else {
      nextDate.setDate(nextDate.getDate() + delta * 7);
    }

    setCurrentDate(nextDate);
    if (laboratoryId) {
      void loadSchedule(laboratoryId, selectedEquipmentId, nextDate, viewMode, onlyMine);
    }
  };

  const handleDateToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (laboratoryId) {
      void loadSchedule(laboratoryId, selectedEquipmentId, today, viewMode, onlyMine);
    }
  };

  const handleSlotClick = (selection: ScheduleSlotSelection) => {
    if (!capabilities.canReserve) return;
    const dateStr = selection.date;
    const startStr = `${String(selection.hour).padStart(2, '0')}:00`;
    const endStr = `${String(selection.hour + 1).padStart(2, '0')}:00`;

    setSlotDefaults({ date: dateStr, startTime: startStr, endTime: endStr });
    setResModalOpen(true);
  };

  // TODO: A conversão civil -> UTC no timezone do laboratório para criação/edição será tratada na revisão especializada.
  const handleCreateReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const dateStr = String(form.get('date'));
    const startStr = String(form.get('startTime'));
    const endStr = String(form.get('endTime'));

    const startsAt = new Date(`${dateStr}T${startStr}:00`).toISOString();
    const endsAt = new Date(`${dateStr}T${endStr}:00`).toISOString();

    const sampleCountVal = String(form.get('sampleCount') ?? '').trim();
    try {
      const result = await readJson<CreateReservationResult>('/api/scheduling/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          equipmentId: form.get('equipmentId'),
          projectId: form.get('projectId'),
          startsAt,
          endsAt,
          purpose: form.get('purpose'),
          sampleCount: sampleCountVal ? Number(sampleCountVal) : null,
          notes: String(form.get('notes') ?? '').trim() || null,
          recurrence: { frequency: 'NONE', weekdays: [], untilDate: null },
        }),
      });

      setResModalOpen(false);

      if (result.conflictingSlots.length > 0) {
        setNotice(
          `✅ ${result.createdReservations.length} ocorrência(s) reservadas com sucesso! ⚠️ ${result.conflictingSlots.length} ocorrência(s) indisponíveis por conflito de horário.`,
        );
      } else {
        setNotice(`✅ Reserva(s) confirmada(s) com sucesso (${result.createdReservations.length} ocorrência(s))!`);
      }

      await loadSchedule(laboratoryId, selectedEquipmentId, currentDate, viewMode, onlyMine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar reserva.');
    } finally {
      setPending(false);
    }
  };

  // TODO: A conversão civil -> UTC no timezone do laboratório para criação/edição será tratada na revisão especializada.
  const handleCreateBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const dateStr = String(form.get('date'));
    const startStr = String(form.get('startTime'));
    const endStr = String(form.get('endTime'));

    const startsAt = new Date(`${dateStr}T${startStr}:00`).toISOString();
    const endsAt = new Date(`${dateStr}T${endStr}:00`).toISOString();

    try {
      await readJson('/api/scheduling/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          equipmentId: form.get('equipmentId'),
          reason: form.get('reason'),
          description: form.get('description'),
          startsAt,
          endsAt,
        }),
      });

      setBlockModalOpen(false);
      setNotice('✅ Bloqueio técnico criado com sucesso!');
      await loadSchedule(laboratoryId, selectedEquipmentId, currentDate, viewMode, onlyMine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar bloqueio técnico.');
    } finally {
      setPending(false);
    }
  };

  const handleCancelItem = async (item: ScheduleItem) => {
    if (!laboratoryId) return;
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;

    setPending(true);
    setError(null);
    try {
      if (item.type === 'RESERVATION') {
        await readJson(`/api/scheduling/reservations/${item.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            laboratoryId,
            reason: 'Cancelado pelo usuário na interface de agenda.',
          }),
        });
      } else {
        await readJson(`/api/scheduling/blocks/${item.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ laboratoryId, reason: 'Bloqueio técnico liberado.' }),
        });
      }

      setSelectedItem(null);
      setNotice('✅ Agendamento cancelado com sucesso.');
      await loadSchedule(laboratoryId, selectedEquipmentId, currentDate, viewMode, onlyMine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar item.');
    } finally {
      setPending(false);
    }
  };

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        {error ?? 'Carregando agenda operacional...'}
      </main>
    );
  }

  const initials = pageData.principal.user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/agenda?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/agenda"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Agenda Operacional"
      userInitials={initials}
      userLabel={pageData.principal.user.name}
    >
      <section className="equipment-toolbar">
        <div>
          <span className="section-kicker">{activeLaboratory.name}</span>
          <h2>Agenda de Equipamentos</h2>
          <p>Consulte a ocupação em tempo real, selecione horários na grade e gerencie bloqueios técnicos.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {capabilities.canReserve ? (
            <button className="primary-button" onClick={() => setResModalOpen(true)} type="button">
              <ArqueiaIcon name="mais" size={18} /> Nova Reserva
            </button>
          ) : null}
          {capabilities.canManageBlocks ? (
            <button className="secondary-button" onClick={() => setBlockModalOpen(true)} type="button">
              <ArqueiaIcon name="mais" size={18} /> Bloqueio Técnico
            </button>
          ) : null}
        </div>
      </section>

      {notice && (
        <div style={{ background: '#e6fffa', border: '1px solid #38b2ac', color: '#234e52', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.5rem 0' }}>
          {notice}
        </div>
      )}



      {/* Control Bar: Filter & Equipment Selection */}
      <section className="agenda-control-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Filtrar por equipamento"
            value={selectedEquipmentId}
            onChange={(e) => handleEquipmentChange(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
          >
            <option value="">Todos os Equipamentos ({equipments.length})</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.code})
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => {
                setOnlyMine(e.target.checked);
                if (laboratoryId) {
                  void loadSchedule(laboratoryId, selectedEquipmentId, currentDate, viewMode, e.target.checked);
                }
              }}
            />
            <span>Minhas reservas</span>
          </label>
        </div>
      </section>

      {/* Schedule Header com Navegação e Ações por Capability */}
      <ScheduleHeader
        capabilities={capabilities}
        currentDate={currentDate}
        isLoading={loading}
        onNewBlock={() => setBlockModalOpen(true)}
        onNewReservation={() => setResModalOpen(true)}
        onNext={() => handleDateNavigate(1)}
        onPrevious={() => handleDateNavigate(-1)}
        onToday={handleDateToday}
        onViewModeChange={handleViewModeChange}
        timezone={timezone}
        viewMode={viewMode}
      />

      {/* Legenda Visual de Reservas e Bloqueios */}
      <ScheduleLegend showCancelled={true} />

      {/* Conteúdo da Agenda e Estados */}
      {loading ? (
        <ScheduleStateFeedback state="loading" />
      ) : error ? (
        <ScheduleStateFeedback
          message={error}
          onRetry={() => {
            if (laboratoryId) {
              void loadSchedule(laboratoryId, selectedEquipmentId, currentDate, viewMode, onlyMine);
            }
          }}
          state="error"
        />
      ) : viewMode === 'DAY' ? (
        <ScheduleDayView
          capabilities={capabilities}
          currentDate={currentDate}
          items={scheduleItems}
          onItemClick={(item) => setSelectedItem(item)}
          onSlotClick={handleSlotClick}
          timezone={timezone}
        />
      ) : (
        <ScheduleWeekView
          capabilities={capabilities}
          currentDate={currentDate}
          items={scheduleItems}
          onItemClick={(item) => setSelectedItem(item)}
          onSlotClick={handleSlotClick}
          timezone={timezone}
        />
      )}

      {/* Drawer / Modal de Detalhes da Reserva ou Bloqueio */}
      <ScheduleDetailsDrawer
        isCancelling={pending}
        isOpen={Boolean(selectedItem)}
        item={selectedItem}
        onCancelItem={handleCancelItem}
        onClose={() => setSelectedItem(null)}
        timezone={timezone}
      />

      {/* Modal Nova Reserva */}
      {resModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="res-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Reserva Operacional</span>
                <h2 id="res-title">Nova Reserva de Equipamento</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setResModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form reservation-quick-form" onSubmit={handleCreateReservation}>
              <label className="field-wide">
                <span>Equipamento *</span>
                <select name="equipmentId" defaultValue={selectedEquipmentId} required>
                  <option value="">Selecione um equipamento</option>
                  {equipments
                    .filter((e) => e.status === 'AVAILABLE')
                    .map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.code}) — Máx: {eq.reservationPolicy.maxReservationMinutes / 60}h
                      </option>
                    ))}
                </select>
              </label>

              <div className="reservation-when field-wide">
                <label><span>Data *</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={slotDefaults.date}
                  required
                />
                </label>
                <label><span>Início *</span>
                  <input type="time" name="startTime" defaultValue={slotDefaults.startTime} required />
                </label>
                <label><span>Término *</span>
                  <input type="time" name="endTime" defaultValue={slotDefaults.endTime} required />
                </label>
              </div>

              <label className="field-wide">
                <span>Projeto *</span>
                <select name="projectId" required>
                  <option value="">Selecione o projeto</option>
                  {projects.map((proj) => <option key={proj.id} value={proj.id}>{proj.code} — {proj.name}</option>)}
                </select>
              </label>

              <label className="field-wide">
                <span>O que você vai fazer? *</span>
                <input name="purpose" placeholder="Ex.: Análise de amostras" required maxLength={500} />
              </label>

              <details className="reservation-more field-wide">
                <summary>Mais opções</summary>
              <div className="reservation-optional-grid">
                <label><span>Quantidade de amostras</span>
                <input type="number" name="sampleCount" min={1} max={10000} placeholder="Opcional" />
              </label>
                <label><span>Observações</span>
                <textarea name="notes" rows={2} maxLength={2000} placeholder="Detalhes opcionais" />
              </label>
              </div>
              </details>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setResModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Confirmando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Bloqueio Técnico */}
      {blockModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="block-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Manutenção & Calibração</span>
                <h2 id="block-title">Criar Bloqueio Técnico</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setBlockModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateBlock}>
              <label className="field-wide">
                <span>Equipamento *</span>
                <select name="equipmentId" defaultValue={selectedEquipmentId} required>
                  <option value="">Selecione o equipamento</option>
                  {equipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-wide">
                <span>Motivo do Bloqueio *</span>
                <select name="reason" required>
                  {(Object.keys(blockReasonLabels) as TechnicalBlockReason[]).map((key) => (
                    <option key={key} value={key}>
                      {blockReasonLabels[key]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Data *</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={slotDefaults.date}
                  required
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ flex: 1 }}>
                  <span>Início *</span>
                  <input type="time" name="startTime" defaultValue="08:00" required />
                </label>
                <label style={{ flex: 1 }}>
                  <span>Término *</span>
                  <input type="time" name="endTime" defaultValue="17:00" required />
                </label>
              </div>

              <label className="field-wide">
                <span>Descrição Técnica *</span>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Detalhamento do serviço de manutenção ou calibração preventiva..."
                  required
                  maxLength={1000}
                />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setBlockModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Criando Bloqueio...' : 'Salvar Bloqueio'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
