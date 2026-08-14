# Sequência Canônica de Execução em PRs — Arqueia (10 PRs)

Este documento define a sequência congelada de 10 PRs de baixo risco e escopo controlado para estabilização de UX, conclusão de Gestão, ciclo de Sessões Revogáveis/MFA (E2.2) e Harness de Integração PostgreSQL (E3.1).

---

## Sequência de PRs

### PR 1 — Consolidar alterações atuais de UX
- **Branch:** `feat/interaction-ux-foundation`
- **Escopo:**
  - Revisar alterações em `apps/web/app/globals.css` e `packages/ui/src/styles.css`;
  - Preservar feedback global, reduced motion e edição inline;
  - Verificar visões mobile (390px) e desktop (1440px);
  - Garantir ausência de misturas com autenticação ou banco.
- **Gates:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, CI verde.

---

### PR 2 — Finalizar E1 de Gestão
- **Branch:** `fix/management-project-pagination`
- **Escopo:**
  - Mover paginação de projetos para SQL no PostgreSQL;
  - Eliminar `projectSummaries.slice()` como paginação principal;
  - Usar cursor opaco estável e ordenação determinística (`reservedHours DESC`, `withdrawalCount DESC`, `projectId ASC`);
  - Tratar projeto não informado;
  - Adicionar teste de integração com dois laboratórios em `PostgresManagementRepository`;
  - Validar consultas com `EXPLAIN (ANALYZE, BUFFERS)`.
- **Gates:** Resposta sempre limitada no banco, zero N+1, isolamento total multi-laboratório, analytics e auditoria independentes.

---

### PR 3 — Contratos de sessão revogável (E2.2 - Parte 1)
- **Branch:** `feat/session-contracts`
- **Escopo:**
  - Remover `refreshSessionInputSchema` baseado apenas em `sessionId`;
  - Definir refresh token opaco como credencial transportada exclusivamente por cookie;
  - Separar resposta interna API→BFF da resposta pública BFF→browser;
  - Definir contratos Zod para login, refresh, logout e listagem/revogação de sessões;
  - Adicionar metadados seguros: dispositivo, criação, último uso e expiração;
  - Garantir que hash e refresh token nunca sejam expostos ao JS do cliente.

---

### PR 4 — Migração do ledger de refresh tokens (E2.2 - Parte 2)
- **Branch:** `feat/session-token-ledger`
- **Escopo:**
  - Criar nova migração `007_session_token_ledger.cjs` (sem editar a `001`);
  - Tabelas `auth_sessions` (estado agregado) e `auth_refresh_tokens` (histórico append-only);
  - Campos: `session_id`, `token_hash` (único), `issued_at`, `expires_at`, `consumed_at`, `revoked_at`, `rotation_parent_id`;
  - Regras transacionais com `FOR UPDATE`;
  - Detecção de reuso de token consumido invalidando TODAS as sessões do usuário;
  - Limite de 5 sessões ativas por usuário (invalida a mais antiga ao criar a 6ª).

---

### PR 5 — Casos de uso e adaptadores de sessão (E2.2 - Parte 3)
- **Branch:** `feat/revocable-sessions`
- **Escopo:**
  - Domínio: portas para sessão e tokens;
  - Aplicação: casos de uso de login com sessão, refresh, logout e revogação;
  - Infraestrutura: gerador criptográfico SHA-256 e adaptador PostgreSQL;
  - Endpoints NestJS: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:sessionId`;
  - Registro de auditoria imutável sem tokens ou segredos.

---

### PR 6 — Integração segura no BFF (E2.2 - Parte 4)
- **Branch:** `feat/session-bff-cookies`
- **Escopo:**
  - Cookies separados para access e refresh (`HttpOnly`, `Secure`, `SameSite=Lax`);
  - Refresh cookie restrito ao caminho necessário (`/api/session/refresh`);
  - Rotação automática controlada pelo BFF;
  - Respostas com `Cache-Control: no-store`;
  - Proteção de origem/CSRF.

---

### PR 7 — Rate limit e proteção de autenticação (E2.2 - Parte 5)
- **Branch:** `feat/auth-rate-limit`
- **Escopo:**
  - Rate limit para login, refresh e reautenticação;
  - Chave composta por IP e identificador normalizado;
  - Respostas padronizadas para evitar enumeração de contas;
  - Fail-safe em caso de indisponibilidade do Redis.

---

### PR 8 — Harness de integração PostgreSQL
- **Branch:** `test/postgres-integration-harness`
- **Escopo:**
  - Helper para banco/schema isolado por suíte de teste;
  - Aplicação automática de migrações em banco efêmero;
  - Comandos separados no `package.json`: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`.

---

### PR 9 — Ledger de estoque real (E3.1)
- **Branch:** `test/inventory-ledger-postgres`
- **Escopo:**
  - Testes PostgreSQL reais para entrada, retirada, descarte e ajuste;
  - Validação de saldo derivado e rejeição de saldo negativo dentro da transação;
  - Concorrência de retiradas simulada com duas conexões.

---

### PR 10 — Concorrência de reservas (E3.1)
- **Branch:** `test/scheduling-concurrency-postgres`
- **Escopo:**
  - Testes PostgreSQL reais para `exclusion constraints` de ocupações/reservas;
  - Duas conexões simultâneas tentando reservar o mesmo horário/equipamento;
  - Validação de precedência de bloqueio técnico sobre reservas.
