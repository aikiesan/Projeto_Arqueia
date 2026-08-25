import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Equipment, ScheduleItem } from '@arqueia/contracts';

import { calculateEventBlockGeometry } from './calendar-time';
import { ScheduleDayView } from './schedule-day-view';

describe('Milestone 4 Empirical Challenger Battery: Geometry & Resource Lanes', () => {
  const spTimezone = 'America/Sao_Paulo'; // UTC-3
  const baseDate = new Date('2026-08-14T12:00:00.000Z'); // 2026-08-14 in Sao Paulo (09:00 BRT)

  const eqSpectrometer: Equipment = {
    id: 'eq-ms-001',
    laboratoryId: 'lab-1',
    catalogOptionId: 'cat-opt-1',
    spaceOptionId: null,
    benchOptionId: null,
    responsibleUserId: null,
    code: 'MS-01',
    name: 'Espectrômetro de Massa',
    assetTag: 'PAT-MS-01',
    serialNumber: 'SN-MS-9876',
    status: 'AVAILABLE',
    reservationPolicy: {
      maxReservationMinutes: 480,
      requiresTraining: true,
      requiresApproval: false,
      absenceReleaseMinutes: 30,
    },
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  };

  const eqHPLC: Equipment = {
    id: 'eq-hplc-002',
    laboratoryId: 'lab-1',
    catalogOptionId: 'cat-opt-2',
    spaceOptionId: null,
    benchOptionId: null,
    responsibleUserId: null,
    code: 'HPLC-01',
    name: 'Cromatógrafo HPLC',
    assetTag: 'PAT-HPLC-01',
    serialNumber: 'SN-HPLC-5432',
    status: 'AVAILABLE',
    reservationPolicy: {
      maxReservationMinutes: 720,
      requiresTraining: false,
      requiresApproval: false,
      absenceReleaseMinutes: 60,
    },
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  };

  const eqSequencer: Equipment = {
    id: 'eq-seq-003',
    laboratoryId: 'lab-1',
    catalogOptionId: 'cat-opt-3',
    spaceOptionId: null,
    benchOptionId: null,
    responsibleUserId: null,
    code: 'SEQ-01',
    name: 'Sequenciador NGS',
    assetTag: 'PAT-SEQ-01',
    serialNumber: 'SN-SEQ-1122',
    status: 'AVAILABLE',
    reservationPolicy: {
      maxReservationMinutes: 1440,
      requiresTraining: true,
      requiresApproval: true,
      absenceReleaseMinutes: 120,
    },
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  };

  describe('1. calculateEventBlockGeometry Empirical Stress Matrix', () => {
    const startHour = 7;
    const endHour = 20;
    const hourHeight = 64;

    it('calculates 6-hour continuous multi-hour span (09:00 to 15:00) with mathematical precision', () => {
      // 09:00 BRT = 12:00 UTC, 15:00 BRT = 18:00 UTC
      const item = {
        startsAt: '2026-08-14T12:00:00.000Z',
        endsAt: '2026-08-14T18:00:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      // Start 09:00 from 07:00 grid = 2 hours = 120 min -> (120/60)*64 = 128px
      expect(geom.top).toBe(128);
      // Duration 6 hours = 360 min -> (360/60)*64 - 3 = 384 - 3 = 381px
      expect(geom.height).toBe(381);
      expect(geom.startTimeLabel).toBe('09:00');
      expect(geom.endTimeLabel).toBe('15:00');
      expect(geom.formattedDuration).toBe('6h');
    });

    it('calculates non-integer hour spans (08:30 to 12:45 = 4h 15min) correctly', () => {
      // 08:30 BRT = 11:30 UTC, 12:45 BRT = 15:45 UTC
      const item = {
        startsAt: '2026-08-14T11:30:00.000Z',
        endsAt: '2026-08-14T15:45:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      // Start 08:30 from 07:00 = 90 min -> Math.round((90/60)*64) = 96px
      expect(geom.top).toBe(96);
      // Duration 4h 15min = 255 min -> Math.round((255/60)*64) - 3 = 272 - 3 = 269px
      expect(geom.height).toBe(269);
      expect(geom.startTimeLabel).toBe('08:30');
      expect(geom.endTimeLabel).toBe('12:45');
      expect(geom.formattedDuration).toBe('4h 15min');
    });

    it('enforces minimum card height (36px) for short same-hour reservations (e.g. 30min)', () => {
      // 10:00 to 10:30 BRT (13:00 to 13:30 UTC)
      const item = {
        startsAt: '2026-08-14T13:00:00.000Z',
        endsAt: '2026-08-14T13:30:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      // Start 10:00 from 07:00 = 3h = 180 min -> 3 * 64 = 192px
      expect(geom.top).toBe(192);
      // 30min calculated height is Math.round((30/60)*64)-3 = 29px, clamped to min 36px
      expect(geom.height).toBe(36);
      expect(geom.startTimeLabel).toBe('10:00');
      expect(geom.endTimeLabel).toBe('10:30');
      expect(geom.formattedDuration).toBe('30min');
    });

    it('clamps events starting before grid startHour to top=0', () => {
      // 05:00 BRT to 09:00 BRT (08:00 to 12:00 UTC) with grid starting at 07:00
      const item = {
        startsAt: '2026-08-14T08:00:00.000Z',
        endsAt: '2026-08-14T12:00:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      expect(geom.top).toBe(0);
      // Visible part is 07:00 to 09:00 = 2h = 120 min -> (120/60)*64 - 3 = 125px
      expect(geom.height).toBe(125);
      expect(geom.startTimeLabel).toBe('05:00');
      expect(geom.endTimeLabel).toBe('09:00');
    });

    it('clamps events ending after grid endHour to maximum grid height', () => {
      // 18:00 BRT to 22:00 BRT (21:00 to 01:00 UTC) with grid ending at 20:00 (total 14 hours = 840 min)
      const item = {
        startsAt: '2026-08-14T21:00:00.000Z',
        endsAt: '2026-08-15T01:00:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      // Start 18:00 from 07:00 = 11h = 660 min -> 11 * 64 = 704px
      expect(geom.top).toBe(704);
      // Total grid ends at 21:00 (endHour 20 + 1 = 21:00) -> 840 min total
      // Visible duration = 840 - 660 = 180 min (3h) -> (180/60)*64 - 3 = 189px
      expect(geom.height).toBe(189);
      expect(geom.startTimeLabel).toBe('18:00');
    });

    it('handles multi-day events crossing into the active day from previous day', () => {
      // Starts 2026-08-13 at 20:00 BRT, ends 2026-08-14 at 11:00 BRT
      const item = {
        startsAt: '2026-08-13T23:00:00.000Z',
        endsAt: '2026-08-14T14:00:00.000Z',
      };

      const geom = calculateEventBlockGeometry(
        item,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(true);
      expect(geom.top).toBe(0);
      // From 07:00 to 11:00 = 4h = 240 min -> (240/60)*64 - 3 = 253px
      expect(geom.height).toBe(253);
    });

    it('evaluates international timezones accurately for identical UTC timestamps', () => {
      // Fixed UTC range: 13:00 UTC to 17:00 UTC (4 hours)
      const item = {
        startsAt: '2026-08-14T13:00:00.000Z',
        endsAt: '2026-08-14T17:00:00.000Z',
      };

      // 1. Sao Paulo (UTC-3) -> 10:00 to 14:00 on 2026-08-14
      const geomSP = calculateEventBlockGeometry(item, '2026-08-14', startHour, endHour, hourHeight, 'America/Sao_Paulo');
      expect(geomSP.isVisible).toBe(true);
      expect(geomSP.top).toBe((10 - 7) * 64); // 192px
      expect(geomSP.startTimeLabel).toBe('10:00');
      expect(geomSP.endTimeLabel).toBe('14:00');

      // 2. UTC -> 13:00 to 17:00 on 2026-08-14
      const geomUTC = calculateEventBlockGeometry(item, '2026-08-14', startHour, endHour, hourHeight, 'UTC');
      expect(geomUTC.isVisible).toBe(true);
      expect(geomUTC.top).toBe((13 - 7) * 64); // 384px
      expect(geomUTC.startTimeLabel).toBe('13:00');
      expect(geomUTC.endTimeLabel).toBe('17:00');

      // 3. New York (EDT, UTC-4 in August) -> 09:00 to 13:00 on 2026-08-14
      const geomNY = calculateEventBlockGeometry(item, '2026-08-14', startHour, endHour, hourHeight, 'America/New_York');
      expect(geomNY.isVisible).toBe(true);
      expect(geomNY.top).toBe((9 - 7) * 64); // 128px
      expect(geomNY.startTimeLabel).toBe('09:00');
      expect(geomNY.endTimeLabel).toBe('13:00');

      // 4. Tokyo (JST, UTC+9) -> 22:00 to 02:00 (Next Day, 2026-08-15)
      const geomTokyoToday = calculateEventBlockGeometry(item, '2026-08-14', startHour, endHour, hourHeight, 'Asia/Tokyo');
      expect(geomTokyoToday.isVisible).toBe(true);
      expect(geomTokyoToday.startTimeLabel).toBe('22:00');
    });

    it('returns isVisible=false and 0 dimensions gracefully on invalid inputs', () => {
      const invalidItem = {
        startsAt: 'invalid-date-string',
        endsAt: 'another-invalid-date',
      };

      const geom = calculateEventBlockGeometry(
        invalidItem,
        '2026-08-14',
        startHour,
        endHour,
        hourHeight,
        spTimezone,
      );

      expect(geom.isVisible).toBe(false);
      expect(geom.top).toBe(0);
      expect(geom.height).toBe(0);
    });
  });

  describe('2. Resource Lanes Column Assignment & Sub-Column Clustering', () => {
    it('renders simultaneous bookings on DIFFERENT machines in separate independent vertical columns (lanes)', () => {
      // 3 simultaneous bookings from 10:00 to 14:00 on 3 distinct machines
      const itemMS: ScheduleItem = {
        id: 'item-ms-1',
        type: 'RESERVATION',
        equipmentId: eqSpectrometer.id,
        equipmentName: eqSpectrometer.name,
        startsAt: '2026-08-14T13:00:00.000Z', // 10:00 BRT
        endsAt: '2026-08-14T17:00:00.000Z',   // 14:00 BRT
        title: 'Análise de Proteômica',
        status: 'CONFIRMED',
        isMine: true,
        canCancel: true,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-ms-1',
          userId: 'user-1',
          userName: 'Alice Smith',
          projectId: 'proj-1',
          projectCode: 'PROJ-01',
          purpose: 'Análise de Proteômica',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const itemHPLC: ScheduleItem = {
        id: 'item-hplc-1',
        type: 'RESERVATION',
        equipmentId: eqHPLC.id,
        equipmentName: eqHPLC.name,
        startsAt: '2026-08-14T13:00:00.000Z', // 10:00 BRT
        endsAt: '2026-08-14T17:00:00.000Z',   // 14:00 BRT
        title: 'Cromatografia de Peptídeos',
        status: 'IN_PROGRESS',
        isMine: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-hplc-1',
          userId: 'user-2',
          userName: 'Bob Jones',
          projectId: 'proj-2',
          projectCode: 'PROJ-02',
          purpose: 'Cromatografia de Peptídeos',
          status: 'IN_PROGRESS',
        },
        blockDetails: null,
      };

      const itemSeq: ScheduleItem = {
        id: 'item-seq-1',
        type: 'RESERVATION',
        equipmentId: eqSequencer.id,
        equipmentName: eqSequencer.name,
        startsAt: '2026-08-14T13:00:00.000Z', // 10:00 BRT
        endsAt: '2026-08-14T17:00:00.000Z',   // 14:00 BRT
        title: 'Sequenciamento RNA-seq',
        status: 'CONFIRMED',
        isMine: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-seq-1',
          userId: 'user-3',
          userName: 'Carlos Silva',
          projectId: 'proj-3',
          projectCode: 'PROJ-03',
          purpose: 'Sequenciamento RNA-seq',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const { container } = render(
        <ScheduleDayView
          currentDate={baseDate}
          equipments={[eqSpectrometer, eqHPLC, eqSequencer]}
          items={[itemMS, itemHPLC, itemSeq]}
          selectedEquipmentId="" // All equipments = Multi-lane mode
          timezone={spTimezone}
        />,
      );

      // Verify 3 distinct equipment lane columns exist in DOM
      const laneColumns = container.querySelectorAll('.schedule-day-lane-column');
      expect(laneColumns).toHaveLength(3);

      // Verify Column 1 (MS-01) contains only itemMS with 100% width and left 0%
      const colMS = container.querySelector(`[data-equipment-id="${eqSpectrometer.id}"]`);
      expect(colMS).not.toBeNull();
      const cardMS = colMS!.querySelector('.schedule-card');
      expect(cardMS).not.toBeNull();
      expect(cardMS).toHaveTextContent('Análise de Proteômica');
      expect((cardMS as HTMLElement).style.left).toBe('0%');
      expect((cardMS as HTMLElement).style.width).toBe('calc(100% - 4px)');

      // Verify Column 2 (HPLC-01) contains only itemHPLC with 100% width and left 0%
      const colHPLC = container.querySelector(`[data-equipment-id="${eqHPLC.id}"]`);
      expect(colHPLC).not.toBeNull();
      const cardHPLC = colHPLC!.querySelector('.schedule-card');
      expect(cardHPLC).not.toBeNull();
      expect(cardHPLC).toHaveTextContent('Cromatografia de Peptídeos');
      expect((cardHPLC as HTMLElement).style.left).toBe('0%');
      expect((cardHPLC as HTMLElement).style.width).toBe('calc(100% - 4px)');

      // Verify Column 3 (SEQ-01) contains only itemSeq with 100% width and left 0%
      const colSeq = container.querySelector(`[data-equipment-id="${eqSequencer.id}"]`);
      expect(colSeq).not.toBeNull();
      const cardSeq = colSeq!.querySelector('.schedule-card');
      expect(cardSeq).not.toBeNull();
      expect(cardSeq).toHaveTextContent('Sequenciamento RNA-seq');
      expect((cardSeq as HTMLElement).style.left).toBe('0%');
      expect((cardSeq as HTMLElement).style.width).toBe('calc(100% - 4px)');
    });

    it('clusters simultaneous/overlapping bookings on the SAME machine into side-by-side sub-columns (50% width each)', () => {
      // 2 overlapping bookings on MS-01 (e.g. Technical Block + Reservation, or overlapping test scenario)
      const itemMS1: ScheduleItem = {
        id: 'item-ms-overlap-1',
        type: 'RESERVATION',
        equipmentId: eqSpectrometer.id,
        equipmentName: eqSpectrometer.name,
        startsAt: '2026-08-14T12:00:00.000Z', // 09:00 to 12:00 BRT (3h)
        endsAt: '2026-08-14T15:00:00.000Z',
        title: 'Reserva A',
        status: 'CONFIRMED',
        isMine: true,
        canCancel: true,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-ms-ov-1',
          userId: 'user-1',
          userName: 'Alice Smith',
          projectId: 'proj-1',
          projectCode: 'PROJ-01',
          purpose: 'Reserva A',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const itemMS2: ScheduleItem = {
        id: 'item-ms-overlap-2',
        type: 'RESERVATION',
        equipmentId: eqSpectrometer.id,
        equipmentName: eqSpectrometer.name,
        startsAt: '2026-08-14T13:00:00.000Z', // 10:00 to 14:00 BRT (4h) - overlaps from 10:00 to 12:00
        endsAt: '2026-08-14T17:00:00.000Z',
        title: 'Reserva B',
        status: 'CONFIRMED',
        isMine: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-ms-ov-2',
          userId: 'user-2',
          userName: 'Bob Jones',
          projectId: 'proj-2',
          projectCode: 'PROJ-02',
          purpose: 'Reserva B',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const { container } = render(
        <ScheduleDayView
          currentDate={baseDate}
          equipments={[eqSpectrometer]}
          items={[itemMS1, itemMS2]}
          selectedEquipmentId=""
          timezone={spTimezone}
        />,
      );

      const colMS = container.querySelector(`[data-equipment-id="${eqSpectrometer.id}"]`);
      expect(colMS).not.toBeNull();

      const cards = colMS!.querySelectorAll('.schedule-card');
      expect(cards).toHaveLength(2);

      const card1 = cards[0] as HTMLElement;
      const card2 = cards[1] as HTMLElement;

      // Card 1 placed in sub-column 0 (left: 0%, width: calc(50% - 4px))
      expect(card1.style.left).toBe('0%');
      expect(card1.style.width).toBe('calc(50% - 4px)');

      // Card 2 placed in sub-column 1 (left: 50%, width: calc(50% - 4px))
      expect(card2.style.left).toBe('50%');
      expect(card2.style.width).toBe('calc(50% - 4px)');
    });

    it('renders sequential non-overlapping bookings on the same machine with full 100% width', () => {
      // 2 sequential non-overlapping bookings: 08:00-10:00 and 11:00-13:00
      const itemSeq1: ScheduleItem = {
        id: 'item-seq-step-1',
        type: 'RESERVATION',
        equipmentId: eqSpectrometer.id,
        equipmentName: eqSpectrometer.name,
        startsAt: '2026-08-14T11:00:00.000Z', // 08:00 to 10:00 BRT
        endsAt: '2026-08-14T13:00:00.000Z',
        title: 'Manhã',
        status: 'CONFIRMED',
        isMine: true,
        canCancel: true,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-seq-1',
          userId: 'user-1',
          userName: 'Alice Smith',
          projectId: 'proj-1',
          projectCode: 'PROJ-01',
          purpose: 'Manhã',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const itemSeq2: ScheduleItem = {
        id: 'item-seq-step-2',
        type: 'RESERVATION',
        equipmentId: eqSpectrometer.id,
        equipmentName: eqSpectrometer.name,
        startsAt: '2026-08-14T14:00:00.000Z', // 11:00 to 13:00 BRT
        endsAt: '2026-08-14T16:00:00.000Z',
        title: 'Tarde',
        status: 'CONFIRMED',
        isMine: false,
        canCancel: false,
        canCheckIn: false,
        canComplete: false,
        reservationDetails: {
          reservationId: 'res-seq-2',
          userId: 'user-2',
          userName: 'Bob Jones',
          projectId: 'proj-2',
          projectCode: 'PROJ-02',
          purpose: 'Tarde',
          status: 'CONFIRMED',
        },
        blockDetails: null,
      };

      const { container } = render(
        <ScheduleDayView
          currentDate={baseDate}
          equipments={[eqSpectrometer]}
          items={[itemSeq1, itemSeq2]}
          selectedEquipmentId=""
          timezone={spTimezone}
        />,
      );

      const colMS = container.querySelector(`[data-equipment-id="${eqSpectrometer.id}"]`);
      const cards = colMS!.querySelectorAll('.schedule-card');
      expect(cards).toHaveLength(2);

      // Both cards occupy full lane width since they belong to different non-overlapping clusters
      expect((cards[0] as HTMLElement).style.left).toBe('0%');
      expect((cards[0] as HTMLElement).style.width).toBe('calc(100% - 4px)');

      expect((cards[1] as HTMLElement).style.left).toBe('0%');
      expect((cards[1] as HTMLElement).style.width).toBe('calc(100% - 4px)');
    });
  });
});
