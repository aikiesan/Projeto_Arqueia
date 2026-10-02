import { expect, test, type Page } from '@playwright/test';

/**
 * Informes: o aluno envia pela etiqueta QR sem login; só a coordenação lê.
 *
 * Cada execução envia no máximo três informes por projeto do Playwright (seis
 * no total), abaixo do teto de envios por origem da API (FIELD_REPORT_RATE_LIMIT).
 */
const basePath = (process.env.E2E_BASE_PATH ?? '').replace(/\/$/, '');
const administratorEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@unicamp.br';
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEV_SEED_ADMIN_PASSWORD ?? 'change-this-dev-password';

const prefixed = (path: string) => `${basePath}${path}`;

async function cp2bLaboratoryId(page: Page): Promise<string> {
  const response = await page.request.get(prefixed('/api/public/laboratories'));
  expect(response.ok()).toBe(true);
  const laboratories = (await response.json()) as { id: string; code: string }[];
  const cp2b = laboratories.find((laboratory) => laboratory.code === 'CP2b');
  expect(cp2b, 'o seed cria o laboratório CP2b').toBeDefined();
  return cp2b!.id;
}

async function submitReport(page: Page, laboratoryId: string, message: string): Promise<string> {
  await page.goto(`${prefixed('/informar')}?laboratory=${laboratoryId}`);
  await page.getByText('Informe geral ou pedido de apoio').click();
  await page.getByRole('textbox', { name: 'Mensagem' }).fill(message);
  await page.getByRole('button', { name: 'Enviar informe' }).click();
  const receipt = page.getByRole('status');
  await expect(receipt).toContainText(/INF-[0-9A-F]{8}/);
  return (await receipt.textContent())?.match(/INF-[0-9A-F]{8}/)?.[0] ?? '';
}

test.describe('Informes pelo QR', () => {
  test('qualquer pessoa envia um informe sem login e recebe só o protocolo', async ({ page }) => {
    const laboratoryId = await cp2bLaboratoryId(page);

    const reference = await submitReport(
      page,
      laboratoryId,
      `Preciso de apoio para usar a centrífuga (${test.info().project.name}).`,
    );

    expect(reference).toMatch(/^INF-[0-9A-F]{8}$/);
    await expect(page.getByRole('link', { name: 'Ver agenda' })).toBeVisible();
  });

  test('a página que compila os informes exige sessão', async ({ page }) => {
    await page.goto(prefixed('/informes'));

    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/login'));
  });

  test('a coordenação vê o informe e faz a triagem', async ({ page }) => {
    const laboratoryId = await cp2bLaboratoryId(page);
    const message = `Filtro da capela saturado — e2e ${Date.now()} (${test.info().project.name}).`;
    await submitReport(page, laboratoryId, message);

    const destination = `/informes?laboratory=${laboratoryId}`;
    await page.goto(`${prefixed('/login')}?next=${encodeURIComponent(destination)}`);
    await page.getByLabel('E-mail').fill(administratorEmail);
    await page.getByLabel('Senha').fill(administratorPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/informes'));

    const card = page.locator('article.field-report-card', { hasText: message });
    await expect(card).toBeVisible();
    await card.getByRole('textbox', { name: /Nota da coordenação/ }).fill('Técnico avisado (e2e).');
    await card.getByRole('button', { name: 'Iniciar análise' }).click();

    await expect(page.getByText(/agora está “Em análise”/)).toBeVisible();
    await expect(card.getByText('Em análise', { exact: true })).toBeVisible();
  });

  test('o sino avisa a coordenação e o Informar do topo abre o formulário', async ({ page }) => {
    const laboratoryId = await cp2bLaboratoryId(page);
    const message = `Balança descalibrada — sino e2e ${Date.now()} (${test.info().project.name}).`;
    await submitReport(page, laboratoryId, message);

    const destination = `/?laboratory=${laboratoryId}`;
    await page.goto(`${prefixed('/login')}?next=${encodeURIComponent(destination)}`);
    await page.getByLabel('E-mail').fill(administratorEmail);
    await page.getByLabel('Senha').fill(administratorPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/'));

    const banner = page.getByRole('banner');
    const bell = banner.getByRole('button', { name: /Notificações: \d+ novas?/ });
    await expect(bell).toBeVisible();
    await bell.click();
    const panel = page.getByRole('region', { name: 'Informes novos' });
    await expect(panel.getByText(message)).toBeVisible();
    await panel.getByRole('link', { name: /Ver todos os informes/ }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/informes'));

    await page.getByRole('banner').getByRole('link', { name: 'Informar' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/informar'));
    expect(new URL(page.url()).searchParams.get('laboratory')).toBe(laboratoryId);
    await expect(page.getByRole('heading', { name: 'Avise a coordenação' })).toBeVisible();
  });
});
