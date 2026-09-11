import { expect, test, type Page } from '@playwright/test';

/**
 * Guarda de implantação em subcaminho.
 *
 * Os testes unitários provam os call sites que foram corrigidos; só este pega um
 * call site *esquecido*. Rode com a pilha servida sob o prefixo de produção:
 *
 *   NEXT_PUBLIC_BASE_PATH=/arqueia E2E_BASE_PATH=/arqueia npm run test:e2e
 *
 * Contra uma pilha que já está no ar (a VM do CP2b, por exemplo), aponte
 * PLAYWRIGHT_TEST_BASE_URL para ela — isso também desliga os servidores de dev
 * do playwright.config.ts, que senão colidem com as portas do PM2:
 *
 *   E2E_BASE_PATH=/arqueia E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=...  *     PLAYWRIGHT_TEST_BASE_URL=https://cp2b.unicamp.br  *     npx playwright test tests/e2e/base-path.spec.ts
 *
 * Rode só este spec ao mirar produção: scheduling.spec.ts cria reservas reais.
 *
 * Sem `E2E_BASE_PATH` o prefixo é vazio e o mesmo roteiro valida a implantação
 * na raiz, que continua suportada.
 */
const basePath = (process.env.E2E_BASE_PATH ?? '').replace(/\/$/, '');
const administratorEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@unicamp.br';
const administratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEV_SEED_ADMIN_PASSWORD ?? 'change-this-dev-password';

const prefixed = (path: string) => `${basePath}${path}`;

/**
 * O destino é obrigatório e verificado: o login termina com uma navegação dura
 * (`window.location.assign`), e seguir antes dela ora encontra a tela de login
 * ainda montada, ora aborta o `goto` seguinte.
 */
async function login(page: Page, destination: string): Promise<void> {
  await page.goto(`${prefixed('/login')}?next=${encodeURIComponent(destination)}`);
  await page.getByLabel('E-mail').fill(administratorEmail);
  await page.getByLabel('Senha').fill(administratorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed(destination));
}

test.describe('navegação sob o base path da implantação', () => {
  test('nenhum link interno escapa do prefixo', async ({ page }) => {
    await login(page, '/mais');

    // `evaluateAll` não espera por elementos: sem esta âncora o teste varre o
    // DOM antes de o React montar os links, e o viewport emulado é lento o
    // bastante para isso acontecer de verdade.
    await page.locator('a[href^="/"]').first().waitFor({ state: 'attached' });

    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));

    const internal = hrefs.filter(
      (href) => href.startsWith('/') && !href.startsWith('//'),
    );
    expect(internal.length).toBeGreaterThan(0);

    for (const href of internal) {
      expect(
        href === basePath || href.startsWith(`${basePath}/`),
        `href fora do prefixo "${basePath}": ${href}`,
      ).toBe(true);
    }
  });

  test('a navegação principal permanece dentro do app', async ({ page }) => {
    // O shell renderiza a barra lateral no desktop e a barra inferior no mobile;
    // apenas a visível entra na árvore de acessibilidade, então o mesmo seletor
    // serve aos dois projetos do Playwright.
    await login(page, '/mais');

    for (const [label, path] of [
      [/Agenda/, '/agenda'],
      [/Estoque/, '/estoque'],
    ] as const) {
      await page.getByRole('link', { name: label }).first().click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed(path));
    }
  });

  test('ícones, manifest e assets carregam sob o prefixo', async ({ page }) => {
    const notFound: string[] = [];
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (response.status() === 404 && !pathname.startsWith(prefixed('/api'))) notFound.push(pathname);
    });

    await login(page, '/mais');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe(prefixed('/manifest.webmanifest'));

    const manifest = await page.request.get(manifestHref as string);
    expect(manifest.ok()).toBe(true);
    const body = (await manifest.json()) as { scope: string; start_url: string };
    expect(body.scope).toBe(`${basePath}/`);
    expect(body.start_url).toBe(`${basePath}/`);

    expect(notFound, `assets ausentes: ${notFound.join(', ')}`).toEqual([]);
  });

  test('o logout volta para o login dentro do prefixo', async ({ page }) => {
    await login(page, '/mais');

    await expect(page.getByRole('link', { name: /Perfil/ }).first()).toHaveAttribute(
      'href',
      prefixed('/perfil'),
    );

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(prefixed('/login'));
  });
});
