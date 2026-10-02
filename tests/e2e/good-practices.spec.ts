import { expect, test, type Page } from '@playwright/test';

/** Boas práticas: públicas para quem não tem conta e item do menu para quem tem. */
const basePath = (process.env.E2E_BASE_PATH ?? '').replace(/\/$/, '');
const administratorEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@unicamp.br';
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEV_SEED_ADMIN_PASSWORD ?? 'change-this-dev-password';

const prefixed = (path: string) => `${basePath}${path}`;

async function login(page: Page, destination: string): Promise<void> {
  await page.goto(`${prefixed('/login')}?next=${encodeURIComponent(destination)}`);
  await page.getByLabel('E-mail').fill(administratorEmail);
  await page.getByLabel('Senha').fill(administratorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed(destination));
}

test.describe('Boas práticas de laboratório', () => {
  test('abrem sem login a partir da tela de entrada, com contatos de emergência da Unicamp', async ({ page }) => {
    await page.goto(prefixed('/login'));
    await page
      .getByRole('navigation', { name: /Sem login/ })
      .getByRole('link', { name: /Boas práticas/ })
      .click();

    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/boas-praticas'));
    await expect(page.getByRole('heading', { level: 1, name: 'Boas práticas de laboratório' })).toBeVisible();
    await expect(page.getByRole('link', { name: '(19) 3521-6000' })).toHaveAttribute(
      'href',
      'tel:+551935216000',
    );
  });

  test('com login, são um item do menu e abrem dentro do app', async ({ page }) => {
    // Desktop: barra lateral. Mobile: a grade de módulos do Mais. Só o que está
    // visível entra na árvore de acessibilidade, então o seletor serve aos dois.
    await login(page, '/mais');
    await page.getByRole('link', { name: /Boas Práticas/ }).first().click();

    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/seguranca'));
    await expect(page.getByRole('heading', { level: 1, name: 'Boas Práticas de Laboratório' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Em caso de acidente' })).toBeVisible();
  });
});
