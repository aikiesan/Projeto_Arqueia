import type {
  AuthenticatedPrincipal,
  Equipment,
  EquipmentPage,
  Laboratory,
  Project,
  ScheduleItem,
  ScheduleResponse,
} from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgendaPageClient } from './agenda-page-client';

let mockSearchParams = new URLSearchParams();

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: replaceMock,
    push: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

function getTodayIso(utcHour: number): string {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toISOString();
}

const now = new Date().toISOString();

const lab1: Laboratory = {
  id: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  institutionId: '6ba7b811-9dad-11d1-b245-5ffdce74fad2',
  name: 'Laboratório CP2b Principal',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const lab2: Laboratory = {
  id: '8e555951-9dc0-41d1-b245-5ffdce74fad3',
  institutionId: '6ba7b811-9dad-11d1-b245-5ffdce74fad2',
  name: 'Laboratório Secundário',
  code: 'LAB-SEC',
  timezone: 'America/Manaus',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const principal: AuthenticatedPrincipal = {
  user: {
    id: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
    institutionId: lab1.institutionId,
    name: 'Dra. Maria Pesquisadora',
    email: 'maria@unicamp.br',
    supervisorUserId: null,
    status: 'ACTIVE',
    identityProvider: 'LOCAL',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
  memberships: [
    {
      id: 'm1',
      userId: '6ba7b810-9dad-11d1-b245-5ffdce74fad2',
      laboratoryId: lab1.id,
      role: 'USUARIO',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
  ],
  systemRoles: [],
};

const sampleEquipment1: Equipment = {
  id: '8f555951-9dc0-41d1-b245-5ffdce74fad2',
  laboratoryId: lab1.id,
  catalogOptionId: '9a666a62-9dc0-41d1-b245-5ffdce74fad2',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'HPLC-01',
  name: 'Cromatógrafo HPLC',
  assetTag: null,
  serialNumber: null,
  status: 'AVAILABLE',
  reservationPolicy: {
    maxReservationMinutes: 240,
    requiresTraining: false,
    requiresApproval: false,
    absenceReleaseMinutes: 30,
  },
  notes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const sampleEquipment2: Equipment = {
  id: '9c666a62-9dc0-41d1-b245-5ffdce74fad4',
  laboratoryId: lab1.id,
  catalogOptionId: '9a666a62-9dc0-41d1-b245-5ffdce74fad2',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'MS-01',
  name: 'Espectrômetro de Massa',
  assetTag: null,
  serialNumber: null,
  status: 'AVAILABLE',
  reservationPolicy: {
    maxReservationMinutes: 360,
    requiresTraining: false,
    requiresApproval: false,
    absenceReleaseMinutes: 30,
  },
  notes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const sampleProject: Project = {
  id: '1a222333-9dc0-41d1-b245-5ffdce74fad5',
  laboratoryId: lab1.id,
  code: 'BIO-2026',
  name: 'Estudo de Proteômica',
  description: 'Projeto ativo de pesquisa',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

function createSampleItems(): ScheduleItem[] {
  return [
    {
      id: 'res-mine-1',
      type: 'RESERVATION',
      equipmentId: sampleEquipment1.id,
      equipmentName: sampleEquipment1.name,
      startsAt: getTodayIso(13),
      endsAt: getTodayIso(15),
      title: 'Análise de Frações HPLC',
      status: 'CONFIRMED',
      isMine: true,
      canCancel: true,
      reservationDetails: {
        reservationId: 'res-mine-1',
        userId: principal.user.id,
        userName: principal.user.name,
        projectId: sampleProject.id,
        projectCode: sampleProject.code,
        purpose: 'Cromatografia líquida',
        sampleCount: 8,
        notes: 'Preparar tampão A e B.',
        status: 'CONFIRMED',
      },
    },
    {
      id: 'res-other-2',
      type: 'RESERVATION',
      equipmentId: sampleEquipment1.id,
      equipmentName: sampleEquipment1.name,
      startsAt: getTodayIso(17),
      endsAt: getTodayIso(19),
      title: 'Equipamento Reservado',
      status: 'CONFIRMED',
      isMine: false,
      canCancel: false,
    },
    {
      id: 'block-1',
      type: 'TECHNICAL_BLOCK',
      equipmentId: sampleEquipment1.id,
      equipmentName: sampleEquipment1.name,
      startsAt: getTodayIso(19),
      endsAt: getTodayIso(21),
      title: 'Manutenção Preventiva',
      status: 'ACTIVE',
      isMine: false,
      canCancel: true,
      blockDetails: {
        technicalBlockId: 'block-1',
        reason: 'MAINTENANCE',
        description: 'Troca de selos e colunas.',
        createdByUserId: 'user-tech-1',
        status: 'ACTIVE',
      },
    },
  ];
}

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('AgendaPageClient Integration', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDefaultFetch(overrides?: {
    scheduleResponse?: Partial<ScheduleResponse>;
    scheduleError?: Error;
    reservationResponse?: Response;
    blockResponse?: Response;
    cancelResponse?: Response;
  }) {
    const defaultScheduleRes: ScheduleResponse = {
      laboratoryId: lab1.id,
      timezone: 'America/Sao_Paulo',
      startsAt: getTodayIso(0),
      endsAt: getTodayIso(23),
      capabilities: {
        canReserve: true,
        canManageBlocks: true,
      },
      items: createSampleItems(),
      ...overrides?.scheduleResponse,
    };

    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([lab1, lab2]);
      if (url.startsWith('/api/equipment?')) {
        const eqPage: EquipmentPage = {
          items: [sampleEquipment1, sampleEquipment2],
          pageInfo: { hasNextPage: false, nextCursor: null },
        };
        return json(eqPage);
      }
      if (url === '/api/projects') {
        return json([sampleProject]);
      }
      if (url.startsWith('/api/scheduling?')) {
        if (overrides?.scheduleError) {
          throw overrides.scheduleError;
        }
        return json(defaultScheduleRes);
      }
      if (url === '/api/scheduling/reservations') {
        return overrides?.reservationResponse ?? json({ createdReservations: [], conflictingSlots: [] });
      }
      if (url === '/api/scheduling/blocks') {
        return overrides?.blockResponse ?? json({});
      }
      if (url.endsWith('/cancel')) {
        return overrides?.cancelResponse ?? json({});
      }
      throw new Error(`URL não mapeada no teste: ${url}`);
    });
  }

  // 1. laboratório indicado por ?laboratory=
  it('1. respeita o laboratório indicado por ?laboratory=', async () => {
    mockSearchParams = new URLSearchParams({ laboratory: lab2.id });
    const fetchSpy = setupDefaultFetch();

    render(<AgendaPageClient />);

    const labNames = await screen.findAllByText('Laboratório Secundário');
    expect(labNames.length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      const scheduleCall = fetchSpy.mock.calls.find(([callUrl]) =>
        String(callUrl).startsWith('/api/scheduling?'),
      );
      expect(scheduleCall).toBeDefined();
      expect(String(scheduleCall?.[0])).toContain(`laboratoryId=${lab2.id}`);
    });
  });

  // 2. equipmentId indicado pela URL
  it('2. respeita equipmentId indicado pela URL e passa na consulta', async () => {
    mockSearchParams = new URLSearchParams({ equipmentId: sampleEquipment2.id });
    const fetchSpy = setupDefaultFetch();

    render(<AgendaPageClient />);

    expect(await screen.findByRole('combobox', { name: 'Filtrar por equipamento' })).toHaveValue(
      sampleEquipment2.id,
    );

    await waitFor(() => {
      const scheduleCall = fetchSpy.mock.calls.find(([callUrl]) =>
        String(callUrl).startsWith('/api/scheduling?'),
      );
      expect(scheduleCall).toBeDefined();
      expect(String(scheduleCall?.[0])).toContain(`equipmentId=${sampleEquipment2.id}`);
    });
  });

  // 3. timezone vindo de ScheduleResponse
  it('3. consome timezone retornado por ScheduleResponse para formatação', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        timezone: 'America/Sao_Paulo',
        items: [createSampleItems()[0]!],
      },
    });

    render(<AgendaPageClient />);

    // 13:00 UTC em America/Sao_Paulo (UTC-3) deve ser formatado como 10:00 – 12:00
    expect((await screen.findAllByText('10:00 – 12:00')).length).toBeGreaterThanOrEqual(1);
  });

  // 4. loading
  it('4. exibe estado de loading durante carregamento com aria-busy', async () => {
    let resolveSchedule: (val: Response) => void;
    const schedulePromise = new Promise<Response>((resolve) => {
      resolveSchedule = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([lab1]);
      if (url.startsWith('/api/equipment?')) {
        return json({ items: [sampleEquipment1], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/projects') return json([sampleProject]);
      if (url.startsWith('/api/scheduling?')) return schedulePromise;
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<AgendaPageClient />);

    const statusEl = await screen.findByRole('status');
    expect(statusEl).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando agenda...')).toBeInTheDocument();

    resolveSchedule!(
      json({
        laboratoryId: lab1.id,
        timezone: 'America/Sao_Paulo',
        startsAt: getTodayIso(0),
        endsAt: getTodayIso(23),
        capabilities: { canReserve: true, canManageBlocks: true },
        items: [],
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Carregando agenda...')).not.toBeInTheDocument();
    });
  });

  // 5. agenda vazia
  it('5. renderiza corretamente quando resposta de agenda é vazia', async () => {
    setupDefaultFetch({
      scheduleResponse: { items: [] },
    });

    render(<AgendaPageClient />);

    expect(await screen.findByText('Nenhum compromisso marcado para este dia.')).toBeInTheDocument();
    expect(screen.queryByText('Análise de Frações HPLC')).not.toBeInTheDocument();
  });

  // 6. falha recuperável e retry
  it('6. exibe erro com opção de retry e recupera sem transformar erro em agenda vazia', async () => {
    let shouldFail = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([lab1]);
      if (url.startsWith('/api/equipment?')) {
        return json({ items: [sampleEquipment1], pageInfo: { hasNextPage: false, nextCursor: null } });
      }
      if (url === '/api/projects') return json([sampleProject]);
      if (url.startsWith('/api/scheduling?')) {
        if (shouldFail) {
          throw new Error('Falha de conexão com o servidor de agenda.');
        }
        return json({
          laboratoryId: lab1.id,
          timezone: 'America/Sao_Paulo',
          startsAt: getTodayIso(0),
          endsAt: getTodayIso(23),
          capabilities: { canReserve: true, canManageBlocks: true },
          items: createSampleItems(),
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<AgendaPageClient />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Falha de conexão com o servidor de agenda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();

    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect((await screen.findAllByText('Análise de Frações HPLC')).length).toBeGreaterThanOrEqual(1);
  });

  // 7. visualização DAY
  it('7. alterna e renderiza visualização DAY', async () => {
    setupDefaultFetch();

    render(<AgendaPageClient />);

    expect(await screen.findByRole('button', { name: 'Dia' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dia' }));

    expect(await screen.findByRole('region', { name: /Grade horária de/i })).toBeInTheDocument();
  });

  // 8. visualização WEEK
  it('8. renderiza visualização WEEK com navegação semanal', async () => {
    setupDefaultFetch();

    render(<AgendaPageClient />);

    expect(await screen.findByRole('tablist', { name: 'Seleção rápida do dia da semana' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  // 9. ausência do modo MONTH
  it('9. não oferece modo MONTH na interface', async () => {
    setupDefaultFetch();

    render(<AgendaPageClient />);

    await screen.findByRole('button', { name: 'Dia' });
    expect(screen.queryByRole('button', { name: 'Mês' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mes' })).not.toBeInTheDocument();
  });

  // 10. capacidades canReserve=true/false
  it('10. exibe botão Nova Reserva estritamente se canReserve=true', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: true, canManageBlocks: false },
      },
    });

    const { unmount } = render(<AgendaPageClient />);
    expect(await screen.findByRole('button', { name: /Criar nova reserva/i })).toBeInTheDocument();

    unmount();

    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: false, canManageBlocks: false },
      },
    });

    render(<AgendaPageClient />);
    await screen.findAllByText('Análise de Frações HPLC');
    expect(screen.queryByRole('button', { name: /Criar nova reserva/i })).not.toBeInTheDocument();
  });

  // 11. capacidades canManageBlocks=true/false
  it('11. exibe botão Bloqueio Técnico estritamente se canManageBlocks=true', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: false, canManageBlocks: true },
      },
    });

    render(<AgendaPageClient />);
    expect(await screen.findByRole('button', { name: /Criar novo bloqueio/i })).toBeInTheDocument();
  });

  // 12. abertura do formulário por ação do cabeçalho
  it('12. abre formulário de nova reserva ao clicar no botão do cabeçalho', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: true, canManageBlocks: true },
      },
    });

    render(<AgendaPageClient />);

    const newResBtn = await screen.findByRole('button', { name: /Criar nova reserva/i });
    fireEvent.click(newResBtn);

    expect(await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i })).toBeInTheDocument();
  });

  // 13. abertura do formulário ao clicar em slot
  it('13. abre modal de reserva ao clicar no slot disponível', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: true, canManageBlocks: true },
        items: [],
      },
    });

    render(<AgendaPageClient />);

    const dayBtn = await screen.findByRole('button', { name: 'Dia' });
    fireEvent.click(dayBtn);

    const slot09 = await screen.findByLabelText('Horário disponível às 09:00');
    fireEvent.click(slot09);

    const dialog = await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i });
    expect(dialog).toBeInTheDocument();
  });

  // 14. preenchimento de date/startTime/endTime pelo ScheduleSlotSelection
  it('14. preenche date, startTime e endTime a partir de ScheduleSlotSelection', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: true, canManageBlocks: true },
        items: [],
      },
    });

    render(<AgendaPageClient />);

    const dayBtn = await screen.findByRole('button', { name: 'Dia' });
    fireEvent.click(dayBtn);

    const slot09 = await screen.findByLabelText('Horário disponível às 09:00');
    fireEvent.click(slot09);

    const dialog = await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i });
    const startInput = dialog.querySelector('input[name="startTime"]') as HTMLInputElement;
    const endInput = dialog.querySelector('input[name="endTime"]') as HTMLInputElement;

    expect(startInput.value).toBe('09:00');
    expect(endInput.value).toBe('10:00');
  });

  // 15. abertura do drawer de detalhes
  it('15. abre o drawer de detalhes ao clicar em um evento', async () => {
    setupDefaultFetch();

    render(<AgendaPageClient />);

    const [eventCard] = await screen.findAllByText('Análise de Frações HPLC');
    expect(eventCard).toBeDefined();
    fireEvent.click(eventCard!);

    expect(await screen.findByRole('dialog', { name: /Análise de Frações HPLC/i })).toBeInTheDocument();
    expect(screen.getByText('Cromatografia líquida')).toBeInTheDocument();
    expect(screen.getByText('Preparar tampão A e B.')).toBeInTheDocument();
  });

  // 16. botão de cancelamento governado por item.canCancel
  it('16. exibe botão de cancelamento apenas quando item.canCancel=true', async () => {
    setupDefaultFetch();

    render(<AgendaPageClient />);

    const [myEvent] = await screen.findAllByText('Análise de Frações HPLC');
    expect(myEvent).toBeDefined();
    fireEvent.click(myEvent!);

    const dialog = await screen.findByRole('dialog', { name: /Análise de Frações HPLC/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    const [otherEvent] = await screen.findAllByText('Equipamento Reservado');
    expect(otherEvent).toBeDefined();
    fireEvent.click(otherEvent!);

    const dialogOther = await screen.findByRole('dialog', { name: /Equipamento Reservado/i });
    expect(dialogOther).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
  });

  // 17. filtro “somente minhas reservas”
  it('17. atualiza consulta ao alternar filtro de somente minhas reservas', async () => {
    const fetchSpy = setupDefaultFetch();

    render(<AgendaPageClient />);

    const checkbox = await screen.findByRole('checkbox', { name: 'Minhas reservas' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map(([callUrl]) => String(callUrl));
      const onlyMineCall = calls.find((url) => url.includes('onlyMine=true'));
      expect(onlyMineCall).toBeDefined();
    });
  });

  // 18. troca de equipamento
  it('18. recarrega a agenda ao selecionar outro equipamento no dropdown', async () => {
    const fetchSpy = setupDefaultFetch();

    render(<AgendaPageClient />);

    const select = await screen.findByRole('combobox', { name: 'Filtrar por equipamento' });
    fireEvent.change(select, { target: { value: sampleEquipment2.id } });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map(([callUrl]) => String(callUrl));
      const eqCall = calls.find((url) => url.includes(`equipmentId=${sampleEquipment2.id}`));
      expect(eqCall).toBeDefined();
    });
  });

  // 19. viewport mobile 390px
  it('19. renderiza estrutura responsiva mobile em 390px', async () => {
    window.innerWidth = 390;
    window.dispatchEvent(new Event('resize'));
    setupDefaultFetch();

    const { container } = render(<AgendaPageClient />);

    await screen.findAllByText('Análise de Frações HPLC');
    expect(container.querySelector('.schedule-week-mobile-strip')).toBeInTheDocument();
    expect(container.querySelector('.schedule-week-mobile-day-content')).toBeInTheDocument();
  });

  // 20. viewport desktop 1440px
  it('20. renderiza estrutura desktop em 1440px', async () => {
    window.innerWidth = 1440;
    window.dispatchEvent(new Event('resize'));
    setupDefaultFetch();

    const { container } = render(<AgendaPageClient />);

    await screen.findAllByText('Análise de Frações HPLC');
    expect(container.querySelector('.schedule-week-grid-container')).toBeInTheDocument();
  });

  // 21. ausência de interpretação de papéis
  it('21. não examina papéis como ADMIN ou TECNICO no cliente', async () => {
    setupDefaultFetch({
      scheduleResponse: {
        capabilities: { canReserve: true, canManageBlocks: true },
      },
    });

    render(<AgendaPageClient />);

    expect(await screen.findByRole('button', { name: /Criar novo bloqueio/i })).toBeInTheDocument();
  });

  // 22. nenhum dado inventado em erro ou resposta vazia
  it('22. não cria dados sintéticos em erro ou resposta vazia', async () => {
    setupDefaultFetch({
      scheduleResponse: { items: [] },
    });

    render(<AgendaPageClient />);

    await screen.findByText('Nenhum compromisso marcado para este dia.');
    expect(screen.queryByText('HPLC Shimadzu LC-2030')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserva de Teste')).not.toBeInTheDocument();
  });

  it('23. envia reserva com horários UTC calculados no timezone do laboratório', async () => {
    const fetchSpy = setupDefaultFetch();
    render(<AgendaPageClient />);

    fireEvent.click(await screen.findByRole('button', { name: /Criar nova reserva/i }));
    const dialog = await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i });
    fireEvent.change(dialog.querySelector('select[name="equipmentId"]')!, {
      target: { value: sampleEquipment1.id },
    });
    fireEvent.change(dialog.querySelector('input[name="date"]')!, {
      target: { value: '2026-08-20' },
    });
    fireEvent.change(dialog.querySelector('input[name="startTime"]')!, {
      target: { value: '09:00' },
    });
    fireEvent.change(dialog.querySelector('input[name="endTime"]')!, {
      target: { value: '10:30' },
    });
    fireEvent.change(dialog.querySelector('select[name="projectId"]')!, {
      target: { value: sampleProject.id },
    });
    fireEvent.change(dialog.querySelector('input[name="purpose"]')!, {
      target: { value: 'Análise de estabilidade' },
    });
    fireEvent.submit(dialog.querySelector('form')!);

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url, init]) => String(url) === '/api/scheduling/reservations' && init?.method === 'POST',
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        startsAt: '2026-08-20T12:00:00.000Z',
        endsAt: '2026-08-20T13:30:00.000Z',
      });
    });
  });

  it('24. envia bloqueio com horários UTC calculados no timezone do laboratório', async () => {
    const fetchSpy = setupDefaultFetch();
    render(<AgendaPageClient />);

    fireEvent.click(await screen.findByRole('button', { name: /Criar novo bloqueio/i }));
    const dialog = await screen.findByRole('dialog', { name: /Criar Bloqueio Técnico/i });
    fireEvent.change(dialog.querySelector('select[name="equipmentId"]')!, {
      target: { value: sampleEquipment1.id },
    });
    fireEvent.change(dialog.querySelector('input[name="date"]')!, {
      target: { value: '2026-08-20' },
    });
    fireEvent.change(dialog.querySelector('input[name="startTime"]')!, {
      target: { value: '08:00' },
    });
    fireEvent.change(dialog.querySelector('input[name="endTime"]')!, {
      target: { value: '17:00' },
    });
    fireEvent.change(dialog.querySelector('textarea[name="description"]')!, {
      target: { value: 'Calibração preventiva anual' },
    });
    fireEvent.submit(dialog.querySelector('form')!);

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url, init]) => String(url) === '/api/scheduling/blocks' && init?.method === 'POST',
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        startsAt: '2026-08-20T11:00:00.000Z',
        endsAt: '2026-08-20T20:00:00.000Z',
      });
    });
  });

  it('25. preserva formulário e agenda quando a reserva recebe conflito 409', async () => {
    setupDefaultFetch({
      reservationResponse: json(
        {
          code: 'RESERVATION_SLOT_CONFLICT',
          message: 'O equipamento já está ocupado no horário selecionado.',
        },
        409,
      ),
    });
    render(<AgendaPageClient />);

    fireEvent.click(await screen.findByRole('button', { name: /Criar nova reserva/i }));
    const dialog = await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i });
    fireEvent.change(dialog.querySelector('select[name="equipmentId"]')!, {
      target: { value: sampleEquipment1.id },
    });
    fireEvent.change(dialog.querySelector('input[name="date"]')!, {
      target: { value: '2026-08-20' },
    });
    fireEvent.change(dialog.querySelector('input[name="startTime"]')!, {
      target: { value: '09:00' },
    });
    fireEvent.change(dialog.querySelector('input[name="endTime"]')!, {
      target: { value: '10:30' },
    });
    fireEvent.change(dialog.querySelector('select[name="projectId"]')!, {
      target: { value: sampleProject.id },
    });
    fireEvent.change(dialog.querySelector('input[name="purpose"]')!, {
      target: { value: 'Finalidade preservada' },
    });
    fireEvent.submit(dialog.querySelector('form')!);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('CONFLITO');
    expect(dialog.querySelector('input[name="purpose"]')).toHaveValue('Finalidade preservada');
    expect(dialog.querySelector('select[name="projectId"]')).toHaveValue(sampleProject.id);
    expect(dialog.querySelector('input[name="startTime"]')).toHaveValue('09:00');
    expect(dialog.querySelector('input[name="endTime"]')).toHaveValue('10:30');
    expect(screen.getAllByText('Análise de Frações HPLC').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Criar nova reserva/i }));
    expect(
      within(await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i })).queryByRole(
        'alert',
      ),
    ).not.toBeInTheDocument();
  });

  it('26. mantém drawer aberto e mostra erro nele quando o cancelamento falha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setupDefaultFetch({
      cancelResponse: json({ message: 'Não foi possível cancelar a reserva.' }, 500),
    });
    render(<AgendaPageClient />);

    const [reservationCard] = await screen.findAllByText('Análise de Frações HPLC');
    expect(reservationCard).toBeDefined();
    fireEvent.click(reservationCard!);
    const dialog = await screen.findByRole('dialog', { name: /Análise de Frações HPLC/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível cancelar a reserva.',
    );
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
  });

  it('27. envia cancelamento autorizado ao endpoint e laboratório corretos', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchSpy = setupDefaultFetch();
    render(<AgendaPageClient />);

    const [reservationCard] = await screen.findAllByText('Análise de Frações HPLC');
    expect(reservationCard).toBeDefined();
    fireEvent.click(reservationCard!);
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: /Análise de Frações HPLC/i })).getByRole(
        'button',
        { name: 'Cancelar reserva' },
      ),
    );

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url) === `/api/scheduling/reservations/res-mine-1/cancel` &&
          init?.method === 'POST',
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ laboratoryId: lab1.id });
    });
  });

  it('28. renderiza somente uma ação para reserva e uma para bloqueio', async () => {
    setupDefaultFetch();
    render(<AgendaPageClient />);

    expect(await screen.findAllByRole('button', { name: /Criar nova reserva/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Criar novo bloqueio/i })).toHaveLength(1);
  });

  it('29. ignora resposta antiga de agenda após uma consulta mais recente', async () => {
    let resolveOldSchedule: (response: Response) => void;
    const oldSchedule = new Promise<Response>((resolve) => {
      resolveOldSchedule = resolve;
    });
    let scheduleCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal });
      if (url === '/api/laboratories') return json([lab1]);
      if (url.startsWith('/api/equipment?')) {
        return json({
          items: [sampleEquipment1, sampleEquipment2],
          pageInfo: { hasNextPage: false, nextCursor: null },
        });
      }
      if (url === '/api/projects') return json([sampleProject]);
      if (url.startsWith('/api/scheduling?')) {
        scheduleCalls += 1;
        if (scheduleCalls === 1) return oldSchedule;
        return json({
          laboratoryId: lab1.id,
          timezone: lab1.timezone,
          startsAt: getTodayIso(0),
          endsAt: getTodayIso(23),
          capabilities: { canReserve: true, canManageBlocks: true },
          items: [{ ...createSampleItems()[0]!, id: 'recent', title: 'Resposta recente' }],
        } satisfies ScheduleResponse);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    render(<AgendaPageClient />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Filtrar por equipamento' }), {
      target: { value: sampleEquipment2.id },
    });
    expect((await screen.findAllByText('Resposta recente')).length).toBeGreaterThanOrEqual(1);

    resolveOldSchedule!(
      json({
        laboratoryId: lab1.id,
        timezone: lab1.timezone,
        startsAt: getTodayIso(0),
        endsAt: getTodayIso(23),
        capabilities: { canReserve: true, canManageBlocks: true },
        items: createSampleItems(),
      } satisfies ScheduleResponse),
    );

    await waitFor(() => {
      expect(screen.getAllByText('Resposta recente').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText('Análise de Frações HPLC')).toHaveLength(0);
    });
  });
});
