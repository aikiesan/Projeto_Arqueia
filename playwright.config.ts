import { defineConfig, devices } from '@playwright/test';

/**
 * Quando PLAYWRIGHT_TEST_BASE_URL aponta para uma pilha que já está rodando
 * — a VM do CP2b, por exemplo — não há servidor de dev para subir. Sem esta
 * distinção o Playwright tenta ocupar 4001/4002, que o PM2 já usa, e morre
 * com EADDRINUSE antes do primeiro teste. O `reuseExistingServer` não cobre
 * o caso: ele sonda a raiz, que sob base path responde 404 e não conta como
 * pronta.
 */
const externalStack = process.env.PLAYWRIGHT_TEST_BASE_URL?.trim() || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalStack ?? 'http://localhost:4002',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  ...(externalStack
    ? {}
    : {
        webServer: [
          {
            command: 'npm run dev --workspace @arqueia/api',
            url: 'http://127.0.0.1:4001/health',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
          {
            command: 'npm run dev --workspace @arqueia/web',
            url: 'http://127.0.0.1:4002',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ],
      }),
});
