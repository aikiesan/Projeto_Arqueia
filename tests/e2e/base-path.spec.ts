import { expect, test, type Page } from '@playwright/test';

/**
 * Guarda de implantação em subcaminho.
 *
 * Os testes unitários provam os call sites que foram corrigidos; só este pega um
 * call site *esquecido*. Rode com a pilha servida sob o prefixo de produção:
 *
 *   NEXT_PUBLIC_BASE_PATH=/arqueia E2E_BASE_PATH=/arqueia npm run test:e2e
 *
 * Sem `E2E_BASE_PATH` o prefixo é vazio e o mesmo roteiro valida a implantação
 * na raiz, que continua suportada.
 */
const basePath = (process.env.E2E_BASE_PATH ?? '').replace(/\/$/, '');
const administratorEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@unicamp.br';
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEV_SEED_ADMIN_PASSWORD ?? 'change-this-dev-password';

const prefixed = (path: string) => (path === '/' ? basePath || '/' : `${basePath}${path}`);

async function login(page: Page): Promise<void> {
  await page.goto(prefixed('/login'));
  await page.getByLabel('E-mail').fill(administratorEmail);
  await page.getByLabel('Senha').fill(administratorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect.poll(() => new URL(page.url()).pathname.startsWith(prefixed('/'))).toBe(true);
}

test.describe('navegação sob o base path da implantação', () => {
  test('nenhuma navegação da barra mobile sai do prefixo', async ({ page }) => {
    await login(page);

    const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
    const links = await navigation.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = await link.getAttribute('href');
      expect(href, 'todo link da navegação precisa de href').not.toBeNull();
      expect(href as string).toMatch(new RegExp(`^${basePath}(/|[?]|$)`));
    }

    for (const label of ['Agenda', 'Estoque']) {
      await navigation.getByRole('link', { name: label }).click();
      await expect.poll(() => new URL(page.url()).pathname).toMatch(
        new RegExp(`^${basePath}/`),
      );
      await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    }
  });

  test('ícones, manifest e assets carregam sob o prefixo', async ({ page }) => {
    const notFound: string[] = [];
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (response.status() === 404 && !pathname.startsWith('/api')) notFound.push(pathname);
    });

    await login(page);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe(prefixed('/manifest.webmanifest'));

    const manifest = await page.request.get(manifestHref as string);
    expect(manifest.ok()).toBe(true);
    const body = (await manifest.json()) as { scope: string; start_url: string };
    expect(body.scope).toBe(`${basePath}/`);
    expect(body.start_url).toBe(`${basePath}/`);

    expect(notFound, `assets ausentes: ${notFound.join(', ')}`).toEqual([]);
  });

  test('a sessão sobrevive a uma navegação dura e o logout volta ao login', async ({ page }) => {
    await login(page);

    await page.goto(prefixed('/mais'));
    await expect(page.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', prefixed('/perfil'));

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/login'));
  });
});
