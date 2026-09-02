import React from 'react';
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
import {
  calculateEventBlockGeometry,
  formatDurationMinutes,
  getCalendarDateInTimezone,
  zonedDateTimeToIso,
} from '../components/scheduling/calendar-time';

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

const now = '2026-08-25T12:00:00.000Z';

const labCP2b: Laboratory = {
  id: '11111111-1111-4111-a111-111111111111',
  institutionId: 'inst-unicamp',
  name: 'Laboratório Central CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const principalUser: AuthenticatedPrincipal = {
  user: {
    id: 'user-maria-1',
    institutionId: 'inst-unicamp',
    loginCode: 'ARQ-MARIA-001',
    academicCategory: 'PESQUISADOR',
    status: 'ACTIVE',
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  },
  memberships: [
    {
      id: 'm-1',
      userId: 'user-maria-1',
      laboratoryId: labCP2b.id,
      role: 'TECNICO',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
  ],
  systemRoles: [],
};

const equipmentHPLC: Equipment = {
  id: 'eq-hplc-111',
  laboratoryId: labCP2b.id,
  catalogOptionId: 'cat-hplc',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'HPLC-01',
  name: 'Cromatógrafo Líquido HPLC',
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

const equipmentMS: Equipment = {
  id: 'eq-ms-222',
  laboratoryId: labCP2b.id,
  catalogOptionId: 'cat-ms',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'MS-02',
  name: 'Espectrômetro de Massas Q-TOF',
  assetTag: null,
  serialNumber: null,
  status: 'MAINTENANCE',
  reservationPolicy: {
    maxReservationMinutes: 480,
    requiresTraining: false,
    requiresApproval: false,
    absenceReleaseMinutes: 30,
  },
  notes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const equipmentNMR: Equipment = {
  id: 'eq-nmr-333',
  laboratoryId: labCP2b.id,
  catalogOptionId: 'cat-nmr',
  spaceOptionId: null,
  benchOptionId: null,
  responsibleUserId: null,
  code: 'RMN-600',
  name: 'Ressonância Magnética Nuclear 600MHz',
  assetTag: null,
  serialNumber: null,
  status: 'UNAVAILABLE',
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

const projectActive: Project = {
  id: 'proj-fapesp-1',
  laboratoryId: labCP2b.id,
  code: 'FAPESP-2026',
  name: 'Projeto FAPESP Proteômica',
  description: 'Análise de biomarcadores',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

function createChallengeScheduleItems(): ScheduleItem[] {
  const calendarDay = getCalendarDateInTimezone(new Date(), 'America/Sao_Paulo');
  return [
    // 4-hour continuous booking on HPLC (10:00 to 14:00 in America/Sao_Paulo => 13:00 to 17:00 UTC)
    {
      id: 'res-hplc-4h',
      type: 'RESERVATION',
      equipmentId: equipmentHPLC.id,
      equipmentName: equipmentHPLC.name,
      startsAt: zonedDateTimeToIso(calendarDay, '10:00', 'America/Sao_Paulo'),
      endsAt: zonedDateTimeToIso(calendarDay, '14:00', 'America/Sao_Paulo'),
      title: 'Cinética Enzimática HPLC',
      status: 'CONFIRMED',
      isMine: true,
      canCancel: true,
      canCheckIn: false,
      canComplete: false,
      reservationDetails: {
        reservationId: 'res-hplc-4h',
        userId: principalUser.user.id,
        projectId: projectActive.id,
        projectCode: projectActive.code,
        purpose: 'Cinética enzimática de longa duração',
        sampleCount: 24,
        notes: 'Manter temperatura controlada.',
        status: 'CONFIRMED',
      },
    },
    // Simultaneous 2-hour booking on MS at the exact same start hour (10:00 to 12:00 America/Sao_Paulo => 13:00 to 15:00 UTC)
    {
      id: 'res-ms-2h',
      type: 'RESERVATION',
      equipmentId: equipmentMS.id,
      equipmentName: equipmentMS.name,
      startsAt: zonedDateTimeToIso(calendarDay, '10:00', 'America/Sao_Paulo'),
      endsAt: zonedDateTimeToIso(calendarDay, '12:00', 'America/Sao_Paulo'),
      title: 'Identificação Peptídica MS',
      status: 'CONFIRMED',
      isMine: false,
      canCancel: false,
      canCheckIn: false,
      canComplete: false,
      reservationDetails: {
        reservationId: 'res-ms-2h',
        userId: 'user-carlos-2',
        projectId: projectActive.id,
        projectCode: projectActive.code,
        purpose: 'Varredura MS/MS',
        sampleCount: 8,
        notes: null,
        status: 'CONFIRMED',
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

describe('Agenda UI & Navigation Empirical Challenge Suite (M4)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupChallengeFetch(overrides?: {
    scheduleResponse?: Partial<ScheduleResponse>;
  }) {
    const calendarDay = getCalendarDateInTimezone(new Date(), 'America/Sao_Paulo');
    const defaultScheduleRes: ScheduleResponse = {
      laboratoryId: labCP2b.id,
      timezone: 'America/Sao_Paulo',
      startsAt: zonedDateTimeToIso(calendarDay, '00:00', 'America/Sao_Paulo'),
      endsAt: zonedDateTimeToIso(calendarDay, '23:59', 'America/Sao_Paulo'),
      capabilities: {
        canReserve: true,
        canManageBlocks: true,
      },
      items: createChallengeScheduleItems(),
      ...overrides?.scheduleResponse,
    };

    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/session') return json({ principal: principalUser });
      if (url === '/api/laboratories') return json([labCP2b]);
      if (url.startsWith('/api/equipment?')) {
        const eqPage: EquipmentPage = {
          items: [equipmentHPLC, equipmentMS, equipmentNMR],
          pageInfo: { hasNextPage: false, nextCursor: null },
        };
        return json(eqPage);
      }
      if (url === '/api/projects') {
        return json([projectActive]);
      }
      if (url.startsWith('/api/scheduling?')) {
        return json(defaultScheduleRes);
      }
      if (url === '/api/scheduling/reservations') {
        return json({ createdReservations: [{ id: 'new-res-1' }], conflictingSlots: [] });
      }
      throw new Error(`URL não tratada: ${url}`);
    });
  }

  describe('1. Equipment Tabs Navigation, Active States, and Keyboard Arrow Switching', () => {
    it('renders master tab (Todos) and individual equipment tabs with operational status indicators and booking badges', async () => {
      setupChallengeFetch();
      render(<AgendaPageClient />);

      const tablist = await screen.findByRole('tablist', { name: 'Filtrar agenda por equipamento' });
      expect(tablist).toBeInTheDocument();

      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs).toHaveLength(4); // "Todos" + HPLC + MS + NMR

      // Tab 0: Todos os Equipamentos
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Todos os Equipamentos');
      expect(tabs[0]).toHaveTextContent('3'); // 3 equipments registered

      // Tab 1: HPLC (AVAILABLE) - 1 active booking
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveTextContent('Cromatógrafo Líquido HPLC');
      expect(tabs[1]).toHaveTextContent('HPLC-01');
      expect(tabs[1]).toHaveTextContent('1'); // 1 booking badge

      // Tab 2: MS (MAINTENANCE) - 1 active booking
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveTextContent('Espectrômetro de Massas Q-TOF');
      expect(tabs[2]).toHaveTextContent('MS-02');
      expect(tabs[2]).toHaveTextContent('1'); // 1 booking badge

      // Tab 3: NMR (OUT_OF_SERVICE) - 0 bookings
      expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[3]).toHaveTextContent('Ressonância Magnética Nuclear 600MHz');
      expect(tabs[3]).toHaveTextContent('RMN-600');
    });

    it('syncs equipment tab selection with underlying select filter and queries scheduling endpoint with equipmentId', async () => {
      const fetchSpy = setupChallengeFetch();
      render(<AgendaPageClient />);

      const tablist = await screen.findByRole('tablist', { name: 'Filtrar agenda por equipamento' });
      const msTab = within(tablist).getByRole('tab', { name: /Espectrômetro de Massas Q-TOF/i });

      fireEvent.click(msTab);

      // Verify tab state updated
      expect(msTab).toHaveAttribute('aria-selected', 'true');

      // Verify select dropdown updated
      const select = screen.getByRole('combobox', { name: 'Filtrar por equipamento' });
      expect(select).toHaveValue(equipmentMS.id);

      // Verify API fetch was called with equipmentId
      await waitFor(() => {
        const matchingCall = fetchSpy.mock.calls.find(([url]) =>
          String(url).startsWith('/api/scheduling?') && String(url).includes(`equipmentId=${equipmentMS.id}`),
        );
        expect(matchingCall).toBeDefined();
      });
    });

    it('handles keyboard navigation (ArrowRight, ArrowLeft, End, Home) across equipment tabs', async () => {
      setupChallengeFetch();
      render(<AgendaPageClient />);

      const tablist = await screen.findByRole('tablist', { name: 'Filtrar agenda por equipamento' });
      const tabs = within(tablist).getAllByRole('tab');

      // Focus "Todos os Equipamentos"
      tabs[0]!.focus();

      // Press ArrowRight -> moves to HPLC
      fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Filtrar por equipamento' })).toHaveValue(equipmentHPLC.id);
      });

      // Press End -> moves to last tab (NMR)
      fireEvent.keyDown(tabs[1]!, { key: 'End' });
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Filtrar por equipamento' })).toHaveValue(equipmentNMR.id);
      });

      // Press Home -> moves back to first tab (Todos)
      fireEvent.keyDown(tabs[3]!, { key: 'Home' });
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Filtrar por equipamento' })).toHaveValue('');
      });
    });
  });

  describe('2. Side-by-Side Resource Lanes (Day View) Isolation', () => {
    it('in Day View with Todos selected, renders independent vertical columns per equipment without visual collision for simultaneous bookings', async () => {
      setupChallengeFetch();
      render(<AgendaPageClient />);

      // Switch to Day view
      fireEvent.click(await screen.findByRole('button', { name: 'Dia' }));

      // Day lanes region
      const region = await screen.findByRole('region', { name: /Grade horária de/i });
      expect(region).toBeInTheDocument();

      // Independent lane columns exist for each equipment
      const hplcLane = region.querySelector(`[data-equipment-id="${equipmentHPLC.id}"]`);
      const msLane = region.querySelector(`[data-equipment-id="${equipmentMS.id}"]`);
      const nmrLane = region.querySelector(`[data-equipment-id="${equipmentNMR.id}"]`);

      expect(hplcLane).toBeInTheDocument();
      expect(msLane).toBeInTheDocument();
      expect(nmrLane).toBeInTheDocument();

      // Simultaneous bookings at 10:00 render in their respective lane columns
      expect(within(hplcLane as HTMLElement).getByText('Cinética Enzimática HPLC')).toBeInTheDocument();
      expect(within(msLane as HTMLElement).getByText('Identificação Peptídica MS')).toBeInTheDocument();
      expect(within(nmrLane as HTMLElement).queryByText('Cinética Enzimática HPLC')).not.toBeInTheDocument();
    });

    it('clicking an empty slot inside a Resource Lane preselects that specific equipment in the reservation modal', async () => {
      setupChallengeFetch();
      render(<AgendaPageClient />);

      // Switch to Day view
      fireEvent.click(await screen.findByRole('button', { name: 'Dia' }));

      const region = await screen.findByRole('region', { name: /Grade horária de/i });
      const msLane = region.querySelector(`[data-equipment-id="${equipmentMS.id}"]`);
      expect(msLane).toBeInTheDocument();

      // Click on available slot at 08:00 in MS lane
      const slot8 = within(msLane as HTMLElement).getByLabelText(/Horário disponível para Espectrômetro de Massas Q-TOF às 08:00/i);
      fireEvent.click(slot8);

      // Reservation modal must open with MS equipment preselected
      const dialog = await screen.findByRole('dialog', { name: /Nova Reserva de Equipamento/i });
      expect(dialog).toBeInTheDocument();

      const eqSelect = dialog.querySelector('select[name="equipmentId"]') as HTMLSelectElement;
      const startInput = dialog.querySelector('input[name="startTime"]') as HTMLInputElement;
      const endInput = dialog.querySelector('input[name="endTime"]') as HTMLInputElement;

      expect(eqSelect.value).toBe(equipmentMS.id);
      expect(startInput.value).toBe('08:00');
      expect(endInput.value).toBe('09:00');
    });
  });

  describe('3. Continuous Multi-Hour Spanning Block Geometry and Timezone Math', () => {
    const tzSP = 'America/Sao_Paulo'; // UTC-3
    const tzManaus = 'America/Manaus'; // UTC-4

    it('calculates exact pixel geometry for 4-hour continuous block (startsAt 13:00 UTC = 10:00 UTC-3)', () => {
      const item4h = {
        startsAt: '2026-08-25T13:00:00.000Z', // 10:00 SP
        endsAt: '2026-08-25T17:00:00.000Z',   // 14:00 SP (4 hours)
      };

      const geom = calculateEventBlockGeometry(
        item4h,
        '2026-08-25',
        7,  // startHour (07:00)
        20, // endHour (20:00)
        64, // hourHeight
        tzSP,
      );

      expect(geom.isVisible).toBe(true);
      // From 07:00 to 10:00 is 3 hours => 3 * 64 = 192px
      expect(geom.top).toBe(192);
      // 4 hours => 4 * 64 - 3 = 253px
      expect(geom.height).toBe(253);
      expect(geom.startTimeLabel).toBe('10:00');
      expect(geom.endTimeLabel).toBe('14:00');
      expect(geom.formattedDuration).toBe('4h');
    });

    it('calculates 6-hour continuous block spanning 08:30 to 14:30 in America/Manaus (UTC-4)', () => {
      const item6h = {
        startsAt: '2026-08-25T12:30:00.000Z', // 08:30 Manaus
        endsAt: '2026-08-25T18:30:00.000Z',   // 14:30 Manaus (6 hours)
      };

      const geom = calculateEventBlockGeometry(
        item6h,
        '2026-08-25',
        7,  // startHour (07:00)
        20, // endHour (20:00)
        64, // hourHeight
        tzManaus,
      );

      expect(geom.isVisible).toBe(true);
      // From 07:00 to 08:30 is 1.5 hours => 1.5 * 64 = 96px
      expect(geom.top).toBe(96);
      // 6 hours => 6 * 64 - 3 = 381px
      expect(geom.height).toBe(381);
      expect(geom.startTimeLabel).toBe('08:30');
      expect(geom.endTimeLabel).toBe('14:30');
      expect(geom.formattedDuration).toBe('6h');
    });

    it('clamps events starting before grid startHour and ending after grid endHour', () => {
      const itemOverGrid = {
        startsAt: '2026-08-25T08:00:00.000Z', // 05:00 SP (before 07:00 startHour)
        endsAt: '2026-08-26T01:00:00.000Z',   // 22:00 SP (after 20:00 endHour)
      };

      const geom = calculateEventBlockGeometry(
        itemOverGrid,
        '2026-08-25',
        7,  // startHour (07:00)
        20, // endHour (20:00)
        64, // hourHeight
        tzSP,
      );

      expect(geom.isVisible).toBe(true);
      expect(geom.top).toBe(0); // clamped to top of grid
      // Total grid is 14 hours (7..20 inclusive) => 14 * 64 - 3 = 893px
      expect(geom.height).toBe(893);
    });

    it('verifies human-readable duration formatting for fractional intervals', () => {
      expect(formatDurationMinutes(15)).toBe('15min');
      expect(formatDurationMinutes(45)).toBe('45min');
      expect(formatDurationMinutes(60)).toBe('1h');
      expect(formatDurationMinutes(75)).toBe('1h 15min');
      expect(formatDurationMinutes(180)).toBe('3h');
      expect(formatDurationMinutes(270)).toBe('4h 30min');
    });
  });
});
