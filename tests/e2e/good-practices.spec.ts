import { expect, test } from '@playwright/test';

/** Boas práticas: públicas, para quem ainda não tem conta. */
const basePath = (process.env.E2E_BASE_PATH ?? '').replace(/\/$/, '');
const prefixed = (path: string) => `${basePath}${path}`;

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
});
