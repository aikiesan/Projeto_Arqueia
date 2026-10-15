// Gera os PNGs (revisão) e o PDF do guia a partir de deck.html.
// Uso: node render.mjs png [1,2,...]   |   node render.mjs pdf saida.pdf
// Precisa do pacote "playwright" (o monorepo da Arqueia já o traz) e de um Chromium;
// defina CHROMIUM_PATH se o Chromium não estiver no lugar padrão do Playwright.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const D = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2] || 'png';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + D + '/deck.html', { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
if (mode === 'png') {
  fs.mkdirSync(D + '/png', { recursive: true });
  const n = await p.locator('section.slide').count();
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  for (let i = 0; i < n; i++) { if (only && !only.includes(i + 1)) continue; await p.locator('section.slide').nth(i).screenshot({ path: `${D}/png/s${String(i + 1).padStart(2, '0')}.png` }); }
  // elementos que passam do rodapé (46 px) ou saem do slide
  const issues = await p.evaluate(() => [...document.querySelectorAll('section.slide')].map((s, i) => {
    const r = s.getBoundingClientRect();
    const bad = [...s.querySelectorAll('*')].filter((e) => {
      if (e.closest('.foot') || e.classList.contains('grain') || e.classList.contains('torn-bottom') || e.classList.contains('kraft')) return false;
      const q = e.getBoundingClientRect(); if (!q.width || !q.height) return false;
      return q.bottom > r.bottom - 46 + 1 || q.right > r.right + 1 || q.left < r.left - 1;
    }).slice(0, 4).map((e) => `${e.tagName}.${e.className} b=${Math.round(e.getBoundingClientRect().bottom - r.top)} r=${Math.round(e.getBoundingClientRect().right - r.left)}`);
    return [i + 1, bad];
  }).filter((x) => x[1].length));
  console.log(JSON.stringify(issues, null, 1));
} else {
  await p.pdf({ path: process.argv[3], width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
}
await b.close();
