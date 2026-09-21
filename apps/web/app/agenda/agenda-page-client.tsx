'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  AuthenticatedPrincipal,
  CreateReservationResult,
  Equipment,
  EquipmentPage,
  Laboratory,
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

/**
 * Maior página que `listEquipmentQuerySchema` aceita. Pedir acima disso faz a
 * API devolver 400 e a agenda inteira cair no estado de erro — não é um número
 * de conveniência, é o teto do contrato.
 */
export const EQUIPMENT_PAGE_SIZE = 50;

/**
 * Carrega o catálogo inteiro do laboratório, página a página.
 *
 * A agenda pedia uma única página e parava. Quem chegava por QR de um
 * equipamento fora dessa página via a agenda abrir com um `equipmentId` que não
 * existia na lista: aba sem destaque, `<select>` em branco e cabeçalho sem o
 * nome. O teto de páginas existe só para não varrer indefinidamente se o
 * servidor paginar sem fim.
 */
export async function loadAllEquipment(
  laboratoryId: string,
  fetchPage: (url: string) => Promise<EquipmentPage> = (url) => readJson<EquipmentPage>(url),
  maxPages = 20,
): Promise<readonly Equipment[]> {
  const items: Equipment[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ laboratoryId, limit: String(EQUIPMENT_PAGE_SIZE) });
    if (cursor) query.set('cursor', cursor);

    const equipmentPage = await fetchPage(`/api/equipment?${query.toString()}`);
    items.push(...equipmentPage.items);

    if (!equipmentPage.pageInfo?.hasNextPage || !equipmentPage.pageInfo.nextCursor) break;
    cursor = equipmentPage.pageInfo.nextCursor;
  }

  return items;
}

export function AgendaPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEquipmentId = searchParams?.get('equipmentId') ?? searchParams?.get('equipment') ?? '';
  const urlLaboratoryId = searchParams?.get('laboratory') ?? '';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [equipments, setEquipments] = useState<readonly Equipment[]>([]);
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

        // Projeto virou texto livre no formulário: a agenda não precisa mais
        // carregar a lista de projetos cadastrados.
        const allEquipment = await loadAllEquipment(preferred.id);
        if (initializationId !== initializationRequestId.current) return;

        setEquipments(allEquipment);

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
          projectLabel: String(form.get('projectLabel') ?? '').trim() || null,
          startsAt,
          endsAt,
          purpose: String(form.get('purpose') ?? '').trim() || null,
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
          projectLabel: String(form.get('projectLabel') ?? '').trim() || null,
          durationMinutes: Number(walkInDuration),
          purpose: String(form.get('purpose') ?? '').trim() || null,
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
      {/*
        O cabeçalho do WorkspaceShell já anuncia o laboratório ativo logo acima.
        Repetir o nome aqui consumia uma tela inteira de rolagem no celular.
      */}
      <section className="equipment-toolbar">
        <div>
          <h2>Agenda de Equipamentos</h2>
          <p>Consulte a ocupação em tempo real, selecione horários na grade e gerencie bloqueios técnicos.</p>
        </div>
      </section>

      {notice && (
        <div aria-live="polite" className="agenda-notice" role="status">
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
      <section className="agenda-control-bar">
        <div className="agenda-filter-group">
          {/* O `aria-label` já nomeia o campo; um rótulo visível duplicaria o
              seletor de equipamento que aparece logo acima em forma de abas. */}
          <div className="agenda-filter-select">
            <select
              aria-label="Filtrar por equipamento"
              onChange={(e) => handleEquipmentChange(e.target.value)}
              value={selectedEquipmentId}
            >
              <option value="">Todos os Equipamentos</option>
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.code})
                </option>
              ))}
            </select>
          </div>

          <label className="agenda-check-field">
            <input
              checked={onlyMine}
              onChange={(e) => handleToggleOnlyMine(e.target.checked)}
              type="checkbox"
            />
            <span>Minhas reservas</span>
          </label>
        </div>

        <div className="agenda-action-group">
          {capabilities.canReserve && (
            <button
              aria-label="Uso imediato por QR Code"
              className="agenda-action-btn agenda-action-btn--walkin"
              onClick={openWalkInModal}
              type="button"
            >
              ⚡ Uso Imediato (QR Code)
            </button>
          )}

          {capabilities.canReserve && (
            <button
              aria-label="Criar nova reserva"
              className="agenda-action-btn agenda-action-btn--primary"
              onClick={() => openReservationModal()}
              type="button"
            >
              Criar nova reserva
            </button>
          )}

          {capabilities.canManageBlocks && (
            <button
              aria-label="Criar novo bloqueio"
              className="agenda-action-btn agenda-action-btn--block"
              onClick={openBlockModal}
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
                <span>Projeto</span>
                <input
                  type="text"
                  name="projectLabel"
                  placeholder="Opcional — ex.: FAPESP 2019-006 ou Mestrado biogás"
                  maxLength={200}
                />
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
              <div className="agenda-time-range field-wide">
                <label>
                  <span>Início *</span>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={slotDefaults.startTime}
                    required
                  />
                </label>
                <label>
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
                <span>O que você vai fazer?</span>
                <input
                  type="text"
                  name="purpose"
                  placeholder="Opcional — ex.: Análise de amostras"
                  minLength={2}
                  maxLength={500}
                />
              </label>

              {/* Recurrence Section */}
              <fieldset className="agenda-recurrence field-wide">
                <legend>Repetição / Recorrência</legend>
                <label className="agenda-check-field">
                  <input
                    type="checkbox"
                    checked={isRecurrent}
                    onChange={(e) => setIsRecurrent(e.target.checked)}
                  />
                  <span>Repetir esta reserva automaticamente</span>
                </label>

                {isRecurrent && (
                  <div className="agenda-recurrence-grid">
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
                        <span className="agenda-weekday-legend">Dias da semana:</span>
                        <div className="agenda-weekday-grid">
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
                                className={`agenda-weekday-chip${isChecked ? ' agenda-weekday-chip--on' : ''}`}
                                key={id}
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
                <div className="agenda-duration-grid">
                  {[
                    { label: '30 min', mins: 30 },
                    { label: '1 hora', mins: 60 },
                    { label: '2 horas', mins: 120 },
                    { label: '3 horas', mins: 180 },
                    { label: '4 horas', mins: 240 },
                  ].map(({ label, mins }) => (
                    <button
                      aria-pressed={walkInDuration === mins}
                      className={`agenda-duration-chip${walkInDuration === mins ? ' agenda-duration-chip--on' : ''}`}
                      key={mins}
                      onClick={() => setWalkInDuration(mins)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="field-wide">
                <span>Projeto</span>
                <input
                  type="text"
                  name="projectLabel"
                  placeholder="Opcional — ex.: FAPESP 2019-006 ou Mestrado biogás"
                  maxLength={200}
                />
              </label>

              <label className="field-wide">
                <span>O que você vai fazer?</span>
                <input
                  type="text"
                  name="purpose"
                  placeholder="Opcional — ex.: Análise rápida de amostras"
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
                  className="primary-button primary-button--walkin"
                  disabled={pending}
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
              <div className="agenda-time-range field-wide">
                <label>
                  <span>Início *</span>
                  <input type="time" name="startTime" defaultValue="08:00" required />
                </label>
                <label>
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
