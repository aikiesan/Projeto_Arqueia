# Fase 1A — Fundação local funcional

## Estado

**Concluída e verificada localmente em 2026-08-14.** Este marco entrega a primeira
aplicação funcional do Arqueia. Ele não inicia a Fase 2 e não declara concluídos os
itens institucionais restantes da Fase 1 (MFA, SSO real e homologação na VM).

## Escopo entregue

- Contratos de identidade/RBAC 1.0.0 em `@arqueia/contracts`.
- PostgreSQL 16 com migração base, `btree_gist`, documentos versionados e
  `AuditEvent` append-only protegido por trigger.
- Seed idempotente de DEV/HOMOLOG com UNICAMP, CP2b, CP2b-DEMO e administrador local.
- API NestJS com `/health`, login local, JWT, memberships recarregadas do banco e
  autorização papel × laboratório.
- Endpoints autenticados de list/create/update para usuários, laboratórios e projetos.
- PWA Next.js com shell operacional mobile e shell de gestão desktop.
- Worker mínimo com configuração e encerramento gracioso.
- Docker Compose apenas para desenvolvimento local; produção continua nativa.
- CI em Node 20 com PostgreSQL 16 e Redis 7.

## Verificação executada

### Qualidade estática e automatizada

- `npm run lint`: aprovado em todos os workspaces.
- `npm run typecheck`: aprovado em todos os workspaces.
- `npm test`: **41 testes aprovados**.
- `npm run build`: aprovado para packages, NestJS, Next.js e worker.
- `npm ci`: executado com sucesso durante o build das imagens Node 20.
- `docker compose config`: aprovado.

### Smoke test real no Docker Desktop

Serviços saudáveis: PostgreSQL 16, Redis 7, API, web e worker.

- `GET http://localhost:4001/health` → `status: ok`.
- `GET http://localhost:4002` → HTTP 200.
- Login local com o administrador do seed → token emitido.
- Endpoints protegidos `/api/laboratories`, `/api/projects` e `/api/users` → dados do
  seed retornados.
- Extensão `btree_gist` confirmada no banco.
- Tentativa direta de `UPDATE audit_events` rejeitada pelo trigger append-only.

Nesta máquina, PostgreSQL e Redis usam portas externas `55432` e `56379`, registradas
apenas no `.env` local ignorado pelo Git; dentro do Compose continuam nas portas
canônicas `5432` e `6379`.

## Itens deliberadamente não implementados neste marco

- Arquivamento de usuários/labs/projetos, alteração de memberships e atribuição de
  papéis: permanecem fechados até existir contrato de reautenticação/MFA.
- Refresh/logout de sessões e MFA administrativo.
- Integração OIDC real: há somente o gancho/configuração do provedor.
- Implantação em homologação na VM Debian.
- Estoque, QR Code, equipamentos e reservas (Fase 2).

## Gate para o próximo passo

Antes de iniciar a Fase 2, validar visualmente este marco com o responsável do produto
e escolher um único próximo bloco. A recomendação é concluir autenticação/sessão/MFA
e homologação da Fase 1 antes de abrir estoque/ledger.
