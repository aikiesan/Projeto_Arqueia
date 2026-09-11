'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  AuthenticatedPrincipal,
  CreateReservationResult,
  Equipment,
  EquipmentPage,
  Laboratory,
  Project,
  RecurrenceRule,
  ScheduleCapabilities,
  ScheduleItem,
  ScheduleResponse,
  TechnicalBlockReason,
} from '@arqueia/contracts';

import { WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  ScheduleDayView,
  ScheduleDetailsDrawer,
  ScheduleEquipmentTabs,
  ScheduleHeader,
  ScheduleLegend,
  ScheduleStateFeedback,
  ScheduleWeekView,
  getCalendarDateInTimezone,
  getScheduleRangeInTimezone,
  shiftCalendarDate,
  zonedDateTimeToIso,
  type ScheduleSlotSelection,
} from '../components/scheduling';
import { createWorkspacePresentation } from '../presentation';
import { BASE_PATH, withBasePath } from '../lib/base-path';

type ViewMode = 'DAY' | 'WEEK';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

const blockReasonLabels: Record<TechnicalBlockReason, string> = {
  MAINTENANCE: 'Manutenção Preventiva / Corretiva',
  CALIBRATION: 'Calibração / Ajuste Técnico',
  INTERRUPTED_SERVICE: 'Interrupção Técnica de Serviço',
  OTHER: 'Outro Bloqueio Operacional',
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(url), { ...init, cache: 'no-store' });
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

export function AgendaPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEquipmentId = searchParams?.get('equipmentId') ?? searchParams?.get('equipment') ?? '';
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
  const [scheduleTimezone, setScheduleTimezone] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ScheduleCapabilities>({
    canReserve: false,
    canManageBlocks: false,
  });

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initializationRequestId = useRef(0);
  const scheduleRequestId = useRef(0);

  // Modais
  const [resModalOpen, setResModalOpen] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  // Form Defaults for Click-to-Reserve
  const [slotDefaults, setSlotDefaults] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    equipmentId?: string;
  }>({
    date: '',
    startTime: '09:00',
    endTime: '11:00',
    equipmentId: '',
  });

  // Walk-In form state
  const [walkInDuration, setWalkInDuration] = useState<number>(60);

  // Recurrence state
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'CUSTOM'
  >('WEEKLY');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);

  const loadSchedule = useCallback(
    async (
      labId: string,
      eqId: string,
      date: Date,
      mode: ViewMode,
      mine: boolean,
      labTimezone: string,
    ) => {
      const requestId = ++scheduleRequestId.current;
      setLoading(true);
      setLoadError(null);
      try {
        const { startsAt, endsAt } = getScheduleRangeInTimezone(date, mode, labTimezone);
        const query = new URLSearchParams({
          laboratoryId: labId,
          startsAt,
          endsAt,
          onlyMine: mine ? 'true' : 'false',
        });
        if (eqId) {
          query.set('equipmentId', eqId);
        }
        const scheduleRes = await readJson<ScheduleResponse>(`/api/scheduling?${query.toString()}`);
        if (requestId !== scheduleRequestId.current) return;
        setScheduleItems(scheduleRes.items);
        setCapabilities(scheduleRes.capabilities);
        setScheduleTimezone(scheduleRes.timezone);
      } catch (loadErr) {
        if (requestId !== scheduleRequestId.current) return;
        if (loadErr instanceof Error && loadErr.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setLoadError(loadErr instanceof Error ? loadErr.message : 'Falha ao carregar a agenda.');
      } finally {
        if (requestId === scheduleRequestId.current) {
          setLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    const initializationId = ++initializationRequestId.current;
    scheduleRequestId.current += 1;

    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        if (initializationId !== initializationRequestId.current) return;
        const preferred = laboratories.find((lab) => lab.id === urlLaboratoryId) ?? laboratories[0];
        if (!preferred) throw new Error('Nenhum laboratório disponível.');

        setPageData({ principal: session.principal, laboratories });
        setLaboratoryId(preferred.id);
        setScheduleTimezone(preferred.timezone);
        setScheduleItems([]);
        setCapabilities({ canReserve: false, canManageBlocks: false });

        const [eqPage, projList] = await Promise.all([
          readJson<EquipmentPage>(`/api/equipment?${new URLSearchParams({ laboratoryId: preferred.id, limit: '50' })}`),
          readJson<readonly Project[]>('/api/projects'),
        ]);
        if (initializationId !== initializationRequestId.current) return;

        setEquipments(eqPage.items);
        setProjects(
          projList.filter(
            (project) => project.laboratoryId === preferred.id && project.status === 'ACTIVE',
          ),
        );

        const activeEqId = urlEquipmentId || '';
        setSelectedEquipmentId(activeEqId);

        await loadSchedule(
          preferred.id,
          activeEqId,
          currentDate,
          viewMode,
          onlyMine,
          preferred.timezone,
        );
      } catch (initErr) {
        if (initializationId !== initializationRequestId.current) return;
        if (initErr instanceof Error && initErr.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setLoadError(initErr instanceof Error ? initErr.message : 'Falha ao inicializar agenda.');
        setLoading(false);
      }
    })();
  }, [loadSchedule, router, urlEquipmentId, urlLaboratoryId]);

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

  const timezone = scheduleTimezone ?? activeLaboratory?.timezone ?? 'UTC';

  const handleEquipmentChange = (eqId: string) => {
    setSelectedEquipmentId(eqId);
    const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
    if (activeLabId) {
      void loadSchedule(activeLabId, eqId, currentDate, viewMode, onlyMine, timezone);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
    if (activeLabId) {
      void loadSchedule(activeLabId, selectedEquipmentId, currentDate, mode, onlyMine, timezone);
    }
  };

  const handleDateNavigate = (delta: number) => {
    const nextDate = shiftCalendarDate(
      currentDate,
      viewMode === 'DAY' ? delta : delta * 7,
      timezone,
    );
    setCurrentDate(nextDate);
    const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
    if (activeLabId) {
      void loadSchedule(activeLabId, selectedEquipmentId, nextDate, viewMode, onlyMine, timezone);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
    if (activeLabId) {
      void loadSchedule(activeLabId, selectedEquipmentId, today, viewMode, onlyMine, timezone);
    }
  };

  const handleToggleOnlyMine = (checked: boolean) => {
    setOnlyMine(checked);
    const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
    if (activeLabId) {
      void loadSchedule(activeLabId, selectedEquipmentId, currentDate, viewMode, checked, timezone);
    }
  };

  const openReservationModal = (defaults?: {
    date: string;
    startTime: string;
    endTime: string;
    equipmentId?: string;
  }) => {
    if (defaults) {
      setSlotDefaults(defaults);
    } else {
      const todayStr = getCalendarDateInTimezone(currentDate, timezone);
      setSlotDefaults({
        date: todayStr,
        startTime: '09:00',
        endTime: '11:00',
        equipmentId: selectedEquipmentId,
      });
    }
    setIsRecurrent(false);
    setRecurrenceFrequency('WEEKLY');
    setRecurrenceWeekdays([]);
    setOperationError(null);
    setResModalOpen(true);
  };

  const closeReservationModal = () => {
    setResModalOpen(false);
    setOperationError(null);
  };

  const openWalkInModal = () => {
    setWalkInDuration(60);
    setOperationError(null);
    setWalkInModalOpen(true);
  };

  const closeWalkInModal = () => {
    setWalkInModalOpen(false);
    setOperationError(null);
  };

  const openBlockModal = () => {
    const todayStr = getCalendarDateInTimezone(currentDate, timezone);
    setSlotDefaults({
      date: todayStr,
      startTime: '08:00',
      endTime: '17:00',
      equipmentId: selectedEquipmentId,
    });
    setOperationError(null);
    setBlockModalOpen(true);
  };

  const closeBlockModal = () => {
    setBlockModalOpen(false);
    setOperationError(null);
  };

  const openScheduleItem = (item: ScheduleItem) => {
    setOperationError(null);
    setSelectedItem(item);
  };

  const handleSlotClick = (selection: ScheduleSlotSelection) => {
    if (!capabilities.canReserve) return;
    const dateStr = selection.date;
    const startStr = `${String(selection.hour).padStart(2, '0')}:00`;
    const endStr = `${String(selection.hour + 1).padStart(2, '0')}:00`;

    openReservationModal({
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      equipmentId: selection.equipmentId ?? selectedEquipmentId,
    });
  };

  const handleCreateReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setOperationError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const dateStr = String(form.get('date'));
    const startStr = String(form.get('startTime'));
    const endStr = String(form.get('endTime'));

    const sampleCountVal = String(form.get('sampleCount') ?? '').trim();
    try {
      const startsAt = zonedDateTimeToIso(dateStr, startStr, timezone);
      const endsAt = zonedDateTimeToIso(dateStr, endStr, timezone);
      if (Date.parse(startsAt) >= Date.parse(endsAt)) {
        throw new RangeError('O horário final deve ser posterior ao horário inicial.');
      }

      let recurrencePayload: RecurrenceRule = {
        frequency: 'NONE',
        weekdays: [],
        untilDate: null,
      };

      if (isRecurrent) {
        const untilDateStr = String(form.get('recurrenceUntilDate') ?? '');
        if (!untilDateStr) {
          throw new RangeError('Informe a data limite para a repetição do agendamento.');
        }
        const untilIso = zonedDateTimeToIso(untilDateStr, endStr, timezone);
        const freq = String(
          form.get('recurrenceFrequency') ?? 'WEEKLY',
        ) as RecurrenceRule['frequency'];

        recurrencePayload = {
          frequency: freq,
          weekdays: freq === 'CUSTOM' ? recurrenceWeekdays : [],
          untilDate: untilIso,
        };
      }

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
          recurrence: recurrencePayload,
        }),
      });

      setOperationError(null);
      setResModalOpen(false);

      if (result.conflictingSlots.length > 0) {
        setNotice(
          `✅ ${result.createdReservations.length} ocorrência(s) reservadas com sucesso! ⚠️ ${result.conflictingSlots.length} data(s) em conflito foram ignoradas.`,
        );
      } else {
        setNotice(
          `✅ Reserva confirmada com sucesso (${result.createdReservations.length} agendamento(s) criado(s))!`,
        );
      }

      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao criar reserva.');
    } finally {
      setPending(false);
    }
  };

  const handleStartWalkIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setOperationError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const sampleCountVal = String(form.get('sampleCount') ?? '').trim();

    try {
      await readJson('/api/scheduling/reservations/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          equipmentId: form.get('equipmentId'),
          projectId: form.get('projectId'),
          durationMinutes: Number(walkInDuration),
          purpose: form.get('purpose'),
          sampleCount: sampleCountVal ? Number(sampleCountVal) : null,
          notes: String(form.get('notes') ?? '').trim() || null,
        }),
      });

      setOperationError(null);
      setWalkInModalOpen(false);
      setNotice('⚡ Uso imediato iniciado com sucesso! O equipamento está registrado como Em Andamento.');

      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao iniciar uso imediato.');
    } finally {
      setPending(false);
    }
  };

  const handleCheckInItem = async (item: ScheduleItem) => {
    if (!laboratoryId) return;
    setPending(true);
    setOperationError(null);
    try {
      await readJson(`/api/scheduling/reservations/${item.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ laboratoryId }),
      });

      setSelectedItem(null);
      setNotice('▶ Check-In realizado! O equipamento está registrado como Em Andamento.');
      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao realizar check-in.');
    } finally {
      setPending(false);
    }
  };

  const handleCompleteItem = async (item: ScheduleItem) => {
    if (!laboratoryId) return;
    setPending(true);
    setOperationError(null);
    try {
      await readJson(`/api/scheduling/reservations/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ laboratoryId }),
      });

      setSelectedItem(null);
      setNotice('✓ Uso finalizado com sucesso! Equipamento liberado.');
      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao finalizar uso.');
    } finally {
      setPending(false);
    }
  };

  const handleCreateBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setOperationError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const dateStr = String(form.get('date'));
    const startStr = String(form.get('startTime'));
    const endStr = String(form.get('endTime'));

    try {
      const startsAt = zonedDateTimeToIso(dateStr, startStr, timezone);
      const endsAt = zonedDateTimeToIso(dateStr, endStr, timezone);
      if (Date.parse(startsAt) >= Date.parse(endsAt)) {
        throw new RangeError('O horário final deve ser posterior ao horário inicial.');
      }
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

      setOperationError(null);
      setBlockModalOpen(false);
      setNotice('✅ Bloqueio técnico criado com sucesso!');
      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao criar bloqueio técnico.');
    } finally {
      setPending(false);
    }
  };

  const handleCancelItem = async (item: ScheduleItem) => {
    if (!laboratoryId) return;
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;

    setPending(true);
    setOperationError(null);
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
      await loadSchedule(
        laboratoryId,
        selectedEquipmentId,
        currentDate,
        viewMode,
        onlyMine,
        timezone,
      );
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Falha ao cancelar item.');
    } finally {
      setPending(false);
    }
  };

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        {loadError ?? 'Carregando agenda operacional...'}
      </main>
    );
  }

  const initials = pageData.principal.user.name.slice(0, 2).toUpperCase();

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
      basePath={BASE_PATH}
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: `/qr?laboratory=${activeLaboratory.id}`, label: 'Ler QR Code' }}
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
      </section>

      {notice && (
        <div aria-live="polite" role="status" style={{ background: '#e6fffa', border: '1px solid #38b2ac', color: '#234e52', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.5rem 0' }}>
          {notice}
        </div>
      )}

      {/* Equipment Selector Pills / Tabs */}
      {equipments.length > 0 && (
        <ScheduleEquipmentTabs
          currentDate={currentDate}
          equipments={equipments}
          items={scheduleItems}
          onSelectEquipment={handleEquipmentChange}
          selectedEquipmentId={selectedEquipmentId}
          timezone={timezone}
        />
      )}

      {/* Control Bar: Filter & Equipment Selection */}
      <section className="agenda-control-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Filtrar por equipamento"
            value={selectedEquipmentId}
            onChange={(e) => handleEquipmentChange(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '0.875rem' }}
          >
            <option value="">Todos os Equipamentos</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.code})
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => handleToggleOnlyMine(e.target.checked)}
            />
            <span>Minhas reservas</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {capabilities.canReserve && (
            <button
              aria-label="Uso imediato por QR Code"
              className="equipment-primary-btn"
              onClick={openWalkInModal}
              style={{ background: '#2b6cb0', borderColor: '#2b6cb0' }}
              type="button"
            >
              ⚡ Uso Imediato (QR Code)
            </button>
          )}

          {capabilities.canReserve && (
            <button
              aria-label="Criar nova reserva"
              className="equipment-primary-btn"
              onClick={() => openReservationModal()}
              type="button"
            >
              Criar nova reserva
            </button>
          )}

          {capabilities.canManageBlocks && (
            <button
              aria-label="Criar novo bloqueio"
              className="equipment-primary-btn"
              onClick={openBlockModal}
              style={{ background: '#dd6b20', borderColor: '#dd6b20' }}
              type="button"
            >
              Criar novo bloqueio
            </button>
          )}
        </div>
      </section>

      {/* Calendar Header & View Switcher */}
      <ScheduleHeader
        currentDate={currentDate}
        onNext={() => handleDateNavigate(1)}
        onPrevious={() => handleDateNavigate(-1)}
        onToday={handleTodayClick}
        onViewModeChange={handleViewModeChange}
        timezone={timezone}
        viewMode={viewMode}
      />

      <ScheduleLegend showCancelled={true} />

      {/* Feedback State or Calendar Content */}
      {loading ? (
        <ScheduleStateFeedback state="loading" />
      ) : loadError ? (
        <ScheduleStateFeedback
          message={loadError}
          onRetry={() => {
            const activeLabId = laboratoryId ?? activeLaboratory?.id ?? null;
            if (activeLabId) {
              void loadSchedule(activeLabId, selectedEquipmentId, currentDate, viewMode, onlyMine, timezone);
            }
          }}
          state="error"
        />
      ) : viewMode === 'WEEK' ? (
        <ScheduleWeekView
          capabilities={capabilities}
          currentDate={currentDate}
          items={scheduleItems}
          onItemClick={openScheduleItem}
          onSlotClick={handleSlotClick}
          selectedEquipmentId={selectedEquipmentId}
          timezone={timezone}
        />
      ) : (
        <ScheduleDayView
          capabilities={capabilities}
          currentDate={currentDate}
          equipments={equipments}
          items={scheduleItems}
          onItemClick={openScheduleItem}
          onSlotClick={handleSlotClick}
          selectedEquipmentId={selectedEquipmentId}
          timezone={timezone}
        />
      )}

      {/* Details Drawer */}
      <ScheduleDetailsDrawer
        errorMessage={operationError}
        isCancelling={pending}
        isCheckingIn={pending}
        isCompleting={pending}
        isOpen={Boolean(selectedItem)}
        item={selectedItem}
        onCancelItem={handleCancelItem}
        onCheckInItem={handleCheckInItem}
        onClose={() => {
          setSelectedItem(null);
          setOperationError(null);
        }}
        onCompleteItem={handleCompleteItem}
        timezone={timezone}
      />

      {/* Modal Nova Reserva */}
      {resModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="res-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Agendamento</span>
                <h2 id="res-title">Nova Reserva de Equipamento</h2>
              </div>
              <button aria-label="Fechar" onClick={closeReservationModal} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateReservation}>
              {operationError ? (
                <p className="form-error equipment-error field-wide" role="alert">
                  {operationError}
                </p>
              ) : null}
              <label className="field-wide">
                <span>Equipamento *</span>
                <select
                  defaultValue={slotDefaults.equipmentId || selectedEquipmentId}
                  key={resModalOpen ? `res-eq-${slotDefaults.equipmentId || selectedEquipmentId}-${slotDefaults.date}-${slotDefaults.startTime}` : 'closed'}
                  name="equipmentId"
                  required
                >
                  <option value="">Selecione o equipamento</option>
                  {equipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-wide">
                <span>Projeto *</span>
                <select name="projectId" required>
                  <option value="">Selecione o projeto</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.code} — {pr.name}
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
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={slotDefaults.startTime}
                    required
                  />
                </label>
                <label style={{ flex: 1 }}>
                  <span>Término *</span>
                  <input
                    type="time"
                    name="endTime"
                    defaultValue={slotDefaults.endTime}
                    required
                  />
                </label>
              </div>

              <label className="field-wide">
                <span>O que você vai fazer? *</span>
                <input
                  type="text"
                  name="purpose"
                  placeholder="Ex.: Análise de amostras"
                  required
                  minLength={2}
                  maxLength={500}
                />
              </label>

              {/* Recurrence Section */}
              <fieldset
                style={{
                  gridColumn: '1 / -1',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  background: '#f7fafc',
                }}
              >
                <legend style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2d3748', padding: '0 0.4rem' }}>
                  Repetição / Recorrência
                </legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isRecurrent}
                    onChange={(e) => setIsRecurrent(e.target.checked)}
                  />
                  <span>Repetir esta reserva automaticamente</span>
                </label>

                {isRecurrent && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <label>
                      <span>Frequência</span>
                      <select
                        name="recurrenceFrequency"
                        value={recurrenceFrequency}
                        onChange={(e) => setRecurrenceFrequency(e.target.value as typeof recurrenceFrequency)}
                      >
                        <option value="DAILY">Diariamente (todos os dias)</option>
                        <option value="WEEKLY">Semanalmente (mesmo dia da semana)</option>
                        <option value="FORTNIGHTLY">Quinzenalmente</option>
                        <option value="MONTHLY">Mensalmente</option>
                        <option value="CUSTOM">Dias específicos da semana</option>
                      </select>
                    </label>

                    {recurrenceFrequency === 'CUSTOM' && (
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                          Dias da semana:
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {[
                            { id: 1, label: 'Seg' },
                            { id: 2, label: 'Ter' },
                            { id: 3, label: 'Qua' },
                            { id: 4, label: 'Qui' },
                            { id: 5, label: 'Sex' },
                            { id: 6, label: 'Sáb' },
                            { id: 0, label: 'Dom' },
                          ].map(({ id, label }) => {
                            const isChecked = recurrenceWeekdays.includes(id);
                            return (
                              <label
                                key={id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  background: isChecked ? '#e6fffa' : '#edf2f7',
                                  color: isChecked ? '#234e52' : '#4a5568',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  border: isChecked ? '1px solid #38b2ac' : '1px solid #cbd5e0',
                                  fontWeight: isChecked ? 700 : 500,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRecurrenceWeekdays((prev) => [...prev, id]);
                                    } else {
                                      setRecurrenceWeekdays((prev) => prev.filter((d) => d !== id));
                                    }
                                  }}
                                  style={{ width: 'auto', minHeight: 'auto' }}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <label>
                      <span>Repetir até a data (Data Limite) *</span>
                      <input
                        type="date"
                        name="recurrenceUntilDate"
                        required={isRecurrent}
                        min={slotDefaults.date || undefined}
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              <details className="reservation-more field-wide">
                <summary>Mais opções</summary>
                <div className="reservation-optional-grid">
                  <label>
                    <span>Quantidade de amostras</span>
                    <input type="number" name="sampleCount" min={1} max={10000} placeholder="Opcional" />
                  </label>
                  <label>
                    <span>Observações</span>
                    <textarea name="notes" rows={2} maxLength={2000} placeholder="Detalhes opcionais" />
                  </label>
                </div>
              </details>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={closeReservationModal} type="button">
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

      {/* Modal Uso Imediato (QR Code Walk-In) */}
      {walkInModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="walkin-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Acesso Direto / QR Code</span>
                <h2 id="walkin-title">⚡ Uso Imediato do Equipamento</h2>
              </div>
              <button aria-label="Fechar" onClick={closeWalkInModal} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleStartWalkIn}>
              {operationError ? (
                <p className="form-error equipment-error field-wide" role="alert">
                  {operationError}
                </p>
              ) : null}

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
                <span>Duração Estimada do Uso *</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {[
                    { label: '30 min', mins: 30 },
                    { label: '1 hora', mins: 60 },
                    { label: '2 horas', mins: 120 },
                    { label: '3 horas', mins: 180 },
                    { label: '4 horas', mins: 240 },
                  ].map(({ label, mins }) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setWalkInDuration(mins)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '4px',
                        border: walkInDuration === mins ? '2px solid #2b6cb0' : '1px solid #cbd5e0',
                        background: walkInDuration === mins ? '#ebf8ff' : '#ffffff',
                        color: walkInDuration === mins ? '#2b6cb0' : '#4a5568',
                        fontWeight: walkInDuration === mins ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="field-wide">
                <span>Projeto *</span>
                <select name="projectId" required>
                  <option value="">Selecione o projeto</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.code} — {pr.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-wide">
                <span>O que você vai fazer? *</span>
                <input
                  type="text"
                  name="purpose"
                  placeholder="Ex.: Análise rápida de amostras"
                  required
                  minLength={2}
                  maxLength={500}
                />
              </label>

              <details className="reservation-more field-wide">
                <summary>Mais opções</summary>
                <div className="reservation-optional-grid">
                  <label>
                    <span>Quantidade de amostras</span>
                    <input type="number" name="sampleCount" min={1} max={10000} placeholder="Opcional" />
                  </label>
                  <label>
                    <span>Observações</span>
                    <textarea name="notes" rows={2} maxLength={2000} placeholder="Detalhes opcionais" />
                  </label>
                </div>
              </details>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={closeWalkInModal} type="button">
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  disabled={pending}
                  style={{ background: '#2b6cb0', borderColor: '#2b6cb0' }}
                  type="submit"
                >
                  {pending ? 'Iniciando...' : '▶ Iniciar Uso Imediato'}
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
              <button aria-label="Fechar" onClick={closeBlockModal} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateBlock}>
              {operationError ? (
                <p className="form-error equipment-error field-wide" role="alert">
                  {operationError}
                </p>
              ) : null}
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
                <button className="secondary-button" onClick={closeBlockModal} type="button">
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
