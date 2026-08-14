# @arqueia/web

Frontend PWA (Next.js). Consome a API via `NEXT_PUBLIC_API_URL` e tipos de `@arqueia/contracts`; usa componentes de `@arqueia/ui`.

- **Mobile-first (operação):** navegação inferior, botão central de QR, fluxos curtos, digitação manual como alternativa à câmera, instalável como PWA.
- **Desktop-first (gestão):** shell estilo Slack (barra de labs, barra de módulos/filtros, área central, painel contextual, busca global e menu de comandos).

Porta padrão: 4002.

```bash
npm run dev --workspace @arqueia/web
npm run typecheck --workspace @arqueia/web
npm run test --workspace @arqueia/web
npm run build --workspace @arqueia/web
```

O manifest é gerado por `app/manifest.ts`. O service worker registra somente assets
públicos estáveis; páginas, API e bundles da aplicação não são persistidos no cache.
