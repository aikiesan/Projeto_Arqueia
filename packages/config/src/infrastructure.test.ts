import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Infrastructure Configuration & Deployment Verification', () => {
  const currentDir = fileURLToPath(new URL('.', import.meta.url));
  const rootDir = resolve(currentDir, '../../..');

  it('verifies PM2 ecosystem configuration and Next.js binary resolution', () => {
    const ecosystemPath = resolve(rootDir, 'infrastructure/pm2/ecosystem.config.js');
    expect(existsSync(ecosystemPath)).toBe(true);

    const content = readFileSync(ecosystemPath, 'utf-8');
    expect(content).toContain('arqueia-api');
    expect(content).toContain('arqueia-web');
    expect(content).toContain('arqueia-worker');

    // Verify arqueia-web uses hoisted next binary path relative to apps/web cwd
    expect(content).toContain("script: '../../node_modules/next/dist/bin/next'");

    // Verify the target Next.js binary actually exists at the resolved path
    const resolvedNextBin = resolve(rootDir, 'apps/web', '../../node_modules/next/dist/bin/next');
    expect(existsSync(resolvedNextBin)).toBe(true);
  });

  it('verifies setup-vm.sh includes remoteip Apache module', () => {
    const setupVmPath = resolve(rootDir, 'infrastructure/scripts/setup-vm.sh');
    expect(existsSync(setupVmPath)).toBe(true);

    const content = readFileSync(setupVmPath, 'utf-8');
    expect(content).toMatch(/a2enmod.*remoteip/);
    expect(content).toContain('sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite remoteip');
  });

  it('verifies deploy-vm.sh includes resilient retry polling loop for health checks', () => {
    const deployVmPath = resolve(rootDir, 'infrastructure/scripts/deploy-vm.sh');
    expect(existsSync(deployVmPath)).toBe(true);

    const content = readFileSync(deployVmPath, 'utf-8');
    expect(content).toContain('MAX_RETRIES=');
    expect(content).toContain('while [ "$attempt" -le "$MAX_RETRIES" ]');
    expect(content).toContain('http://localhost:4001/api/health');
    expect(content).toContain('http://localhost:4002/api/health');
    expect(content).toContain('sleep');
  });

  it('verifies Apache virtual host configuration consistency', () => {
    const apacheConfPath = resolve(rootDir, 'infrastructure/proxy/arqueia.cp2b.unicamp.br.apache.conf');
    expect(existsSync(apacheConfPath)).toBe(true);

    const content = readFileSync(apacheConfPath, 'utf-8');
    expect(content).toContain('RemoteIPHeader X-Forwarded-For');
    expect(content).toContain('RemoteIPInternalProxy 127.0.0.1');
    expect(content).toContain('remoteip');
  });
});
