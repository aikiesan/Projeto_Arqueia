import { expect, test, type Page, type TestInfo } from '@playwright/test';

const administratorEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@unicamp.br';
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEV_SEED_ADMIN_PASSWORD ?? 'change-this-dev-password';
const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:4001';

interface SchedulingFixture {
  laboratoryId: string;
  equipmentId: string;
  projectId: string;
  accessToken: string;
}

function projectOffset(testInfo: TestInfo): number {
  return testInfo.project.name === 'Mobile Chrome' ? 2 : 1;
}

function calendarDateAfter(days: number): string {
  const instant = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function login(page: Page): Promise<void> {
  await page.goto('/login?next=/agenda');
  await page.getByLabel('E-mail').fill(administratorEmail);
  await page.getByLabel('Senha').fill(administratorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/agenda');

  const laboratoriesResponse = await page.request.get('/api/laboratories');
  expect(laboratoriesResponse.ok(), 'authenticated laboratory lookup must succeed').toBe(true);
  const laboratories = (await laboratoriesResponse.json()) as Array<{ id: string; code: string }>;
  const laboratory = laboratories.find((candidate) => candidate.code === 'CP2b');
  expect(laboratory, 'seed must expose the CP2b laboratory workspace').toBeTruthy();
  await page.goto(`/agenda?laboratory=${laboratory!.id}`);
  await expect(page).toHaveURL(/laboratory=/);
}

async function schedulingFixture(page: Page): Promise<SchedulingFixture> {
  const laboratoryId = new URL(page.url()).searchParams.get('laboratory');
  expect(laboratoryId, 'agenda URL must identify the selected laboratory').toBeTruthy();

  const [equipmentResponse, projectsResponse] = await Promise.all([
    page.request.get(`/api/equipment?laboratoryId=${laboratoryId}&limit=50`),
    page.request.get('/api/projects'),
  ]);
  expect(equipmentResponse.ok(), 'authenticated equipment lookup must succeed').toBe(true);
  expect(projectsResponse.ok(), 'authenticated project lookup must succeed').toBe(true);

  const equipmentPage = (await equipmentResponse.json()) as {
    items: Array<{ id: string; status: string }>;
  };
  const projects = (await projectsResponse.json()) as Array<{
    id: string;
    laboratoryId: string;
    status: string;
  }>;
  const equipmentId = equipmentPage.items.find((equipment) => equipment.status === 'AVAILABLE')?.id;
  const projectId = projects.find(
    (project) => project.laboratoryId === laboratoryId && project.status === 'ACTIVE',
  )?.id;
  const accessToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'arqueia_session',
  )?.value;

  expect(equipmentId, 'seed must provide an available equipment').toBeTruthy();
  expect(projectId, 'seed must provide an active project').toBeTruthy();
  expect(accessToken, 'login must create the HttpOnly session cookie').toBeTruthy();

  return {
    laboratoryId: laboratoryId!,
    equipmentId: equipmentId!,
    projectId: projectId!,
    accessToken: accessToken!,
  };
}

async function cancelReservation(
  page: Page,
  fixture: SchedulingFixture,
  reservationId: string,
): Promise<void> {
  const response = await page.request.post(
    `${apiBaseUrl}/api/scheduling/reservations/${reservationId}/cancel`,
    {
      headers: {
        Authorization: `Bearer ${fixture.accessToken}`,
        'Content-Type': 'application/json',
        'X-Request-Id': crypto.randomUUID(),
      },
      data: {
        laboratoryId: fixture.laboratoryId,
        reason: 'Limpeza determinística do teste E2E',
      },
    },
  );
  expect(response.ok(), 'created E2E reservation must be cancellable').toBe(true);
}

async function createReservation(
  page: Page,
  fixture: SchedulingFixture,
  input: { startsAt: string; endsAt: string; purpose: string },
) {
  return page.request.post(`${apiBaseUrl}/api/scheduling/reservations`, {
    headers: {
      Authorization: `Bearer ${fixture.accessToken}`,
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
    },
    data: {
      laboratoryId: fixture.laboratoryId,
      equipmentId: fixture.equipmentId,
      projectId: fixture.projectId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      purpose: input.purpose,
      recurrence: { frequency: 'NONE', weekdays: [], untilDate: null },
    },
  });
}

test.describe('Agenda multi-equipment', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renders the authenticated agenda controls', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Agenda de Equipamentos', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dia', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semana' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Criar nova reserva/i })).toBeVisible();
  });

  test('renders one resource lane per equipment and filters with equipment tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Dia', exact: true }).click();
    const tablist = page.getByRole('tablist', { name: 'Filtrar agenda por equipamento' });
    await expect(tablist).toBeVisible();

    const tabs = tablist.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThan(1);
    await expect(page.locator('.schedule-day-lane-column').first()).toBeVisible();

    const equipmentTab = tabs.nth(1);
    await equipmentTab.click();
    await expect(equipmentTab).toHaveAttribute('aria-selected', 'true');
  });

  test('renders a five-hour reservation as one continuous block', async ({ page }, testInfo) => {
    const fixture = await schedulingFixture(page);
    const daysAhead = projectOffset(testInfo);
    const date = calendarDateAfter(daysAhead);
    const purpose = `E2E continuous block ${testInfo.project.name}`;
    const response = await createReservation(page, fixture, {
      startsAt: `${date}T15:00:00.000Z`,
      endsAt: `${date}T20:00:00.000Z`,
      purpose,
    });
    const responseBody = (await response.json()) as {
      createdReservations: Array<{ id: string }>;
    };
    expect(response.status(), JSON.stringify(responseBody)).toBe(201);
    const result = responseBody;
    const reservationId = result.createdReservations[0]?.id;
    expect(reservationId, 'reservation response must include the created identifier').toBeTruthy();

    try {
      await page.goto(`/agenda?laboratory=${fixture.laboratoryId}`);
      await page.getByRole('button', { name: 'Dia', exact: true }).click();
      for (let day = 0; day < daysAhead; day += 1) {
        await page.getByRole('button', { name: 'Próximo período' }).click();
      }

      const card = page.locator('.schedule-card', { hasText: purpose });
      await expect(card).toHaveCount(1);
      await expect(card.locator('.schedule-card-time')).toContainText('12:00');
      await expect(card.locator('.schedule-card-time')).toContainText('17:00');
      expect((await card.boundingBox())?.height ?? 0).toBeGreaterThan(200);
    } finally {
      await cancelReservation(page, fixture, reservationId!);
    }
  });

  test('atomically rejects one of two overlapping reservations', async ({ page }, testInfo) => {
    const fixture = await schedulingFixture(page);
    const date = calendarDateAfter(10 + projectOffset(testInfo));
    const input = {
      startsAt: `${date}T13:00:00.000Z`,
      endsAt: `${date}T15:00:00.000Z`,
      purpose: `E2E atomic conflict ${testInfo.project.name}`,
    };

    const responses = await Promise.all([
      createReservation(page, fixture, input),
      createReservation(page, fixture, input),
    ]);
    const responseBodies = await Promise.all(responses.map((response) => response.json()));
    const createdReservationIds = responseBodies.flatMap((body) => {
      const result = body as { createdReservations?: Array<{ id: string }> };
      return result.createdReservations?.map((reservation) => reservation.id) ?? [];
    });

    try {
      expect(
        responses.map((response) => response.status()).sort(),
        JSON.stringify(responseBodies),
      ).toEqual([201, 409]);
      expect(createdReservationIds, 'one concurrent request must create a reservation').toHaveLength(1);
      const conflict = responses.find((response) => response.status() === 409)!;
      const conflictIndex = responses.indexOf(conflict);
      expect(responseBodies[conflictIndex]).toMatchObject({ code: 'RESERVATION_SLOT_CONFLICT' });
    } finally {
      await Promise.all(
        createdReservationIds.map((reservationId) =>
          cancelReservation(page, fixture, reservationId),
        ),
      );
    }
  });
});
