# ADR-003 — Monorepo TypeScript (Next + Nest + Postgres + Redis)

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto
Precisamos de uma base implantável e auditável (não uma SPA com dados simulados), mobile-first para operação e desktop-first para gestão, com API modular e trabalho assíncrono (alertas, e-mails, relatórios).

## Decisão
Monorepo TypeScript com npm workspaces:
- **web:** Next.js (PWA responsivo).
- **api:** NestJS (modular, camadas SOLID).
- **worker:** Node consumindo filas Redis.
- **Banco:** PostgreSQL. **Filas/cache:** Redis.
- **Contratos compartilhados** em `packages/contracts` (fonte da verdade).
- **Testes:** Vitest + Testing Library + Playwright. **CI:** GitHub Actions.

## Consequências
- (+) Tipos ponta a ponta; contrato único destrava trabalho paralelo (Opus congela contrato, Haiku preenche).
- (+) Nest impõe fronteiras modulares que sustentam SOLID.
- (−) Nest adiciona alguma cerimônia; aceitável dado o domínio (transações, permissões, auditoria). Alternativa mais enxuta (Fastify) registrada como fallback caso a complexidade inicial pese.

## Alternativas consideradas
- **SPA só com mock:** rejeitado — não atende auditabilidade/implantação.
- **Fastify/Express no lugar de Nest:** menos estrutura; mantido como opção se a equipe preferir reduzir cerimônia.
