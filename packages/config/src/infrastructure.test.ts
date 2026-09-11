import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Infrastructure Configuration & Deployment Verification', () => {
  const currentDir = fileURLToPath(new URL('.', import.meta.url));
  const rootDir = resolve(currentDir, '../../..');

  it('verifies PM2 uses the production data volume and the hoisted Next.js binary', () => {
    const ecosystemPath = resolve(rootDir, 'infrastructure/pm2/ecosystem.config.js');
    expect(existsSync(ecosystemPath)).toBe(true);

    const content = readFileSync(ecosystemPath, 'utf-8');
    expect(content).toContain('arqueia-api');
    expect(content).toContain('arqueia-web');
    expect(content).toContain('arqueia-worker');

    expect(content).toContain("cwd: '/data/arqueia/repo/apps/web'");
    expect(content).toContain("script: '/data/arqueia/repo/node_modules/next/dist/bin/next'");
    expect(content).toContain("NEXT_PUBLIC_BASE_PATH: '/arqueia'");

    // The same hoisted dependency must exist in the local installation used to build the release.
    const resolvedNextBin = resolve(rootDir, 'node_modules/next/dist/bin/next');
    expect(existsSync(resolvedNextBin)).toBe(true);
  });

  it('verifies setup loads protected environment and prepares the /data volume', () => {
    const setupVmPath = resolve(rootDir, 'infrastructure/scripts/setup-vm.sh');
    expect(existsSync(setupVmPath)).toBe(true);

    const content = readFileSync(setupVmPath, 'utf-8');
    expect(content).toContain('/data/arqueia/postgresql');
    expect(content).toContain('chmod 600 .env');
    expect(content).toContain('. ./.env');
    expect(content).toContain('NEXT_PUBLIC_BASE_PATH=/arqueia npm run build');
    expect(content).not.toContain('certbot');
  });

  it('verifies deploy-vm.sh includes resilient retry polling loop for health checks', () => {
    const deployVmPath = resolve(rootDir, 'infrastructure/scripts/deploy-vm.sh');
    expect(existsSync(deployVmPath)).toBe(true);

    const content = readFileSync(deployVmPath, 'utf-8');
    expect(content).toContain('MAX_RETRIES=');
    expect(content).toContain('while [ "$attempt" -le "$MAX_RETRIES" ]');
    expect(content).toContain('http://localhost:4001/api/health');
    expect(content).toContain('http://localhost:4002/arqueia/api/health');
    expect(content).toContain('http://localhost:4002/arqueia/login');
    expect(content).toContain('sleep');
  });

  it('keeps all public Arqueia traffic behind the Next.js BFF path', () => {
    const apacheConfPath = resolve(rootDir, 'infrastructure/proxy/cp2b-arqueia-path.apache.conf');
    expect(existsSync(apacheConfPath)).toBe(true);

    const content = readFileSync(apacheConfPath, 'utf-8');
    expect(content).toContain('ProxyPass        /arqueia            http://127.0.0.1:4002/arqueia');
    // Carga estrutural: sem isto o Host chega como 127.0.0.1:4002 e a checagem
    // anti-CSRF do BFF derruba todo login com 403.
    expect(content).toContain('ProxyPreserveHost On');
    expect(content).toContain('RequestHeader set X-Forwarded-Proto "https"');
    expect(content).toContain('RequestHeader set X-Forwarded-Prefix "/arqueia"');
    expect(content).not.toContain('127.0.0.1:4001');
    expect(content).not.toContain('<VirtualHost');
    expect(content).not.toContain('certbot');
  });
});
