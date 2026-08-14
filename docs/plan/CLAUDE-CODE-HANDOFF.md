# Prompt de handoff para o Claude Code

Copie o bloco abaixo e cole no Claude Code, na raiz do repositório `Projeto_Arqueia`.

---

```
Você vai continuar o desenvolvimento do projeto Arqueia (plataforma de gestão de
infraestrutura laboratorial). O repositório JÁ contém um plano completo, documentação
de arquitetura e o esqueleto do monorepo. NÃO recomece do zero.

## Antes de escrever qualquer código, leia nesta ordem:
1. README.md — visão geral e mapa do repositório.
2. AGENTS.md — convenções OBRIGATÓRIAS: camadas SOLID por módulo, princípios não
   negociáveis e o critério de divisão de tarefas Haiku vs Opus.
3. docs/plan/ROADMAP.md — as fases 0–5.
4. docs/plan/TASK-ORCHESTRATION.md — tarefas por fase, dependências e o que roda em paralelo.
5. docs/decisions/ADR-001..ADR-006 — decisões travadas (não as contrarie sem novo ADR).
6. docs/architecture/DATA-MODEL.md e ARCHITECTURE.md — modelo de dados e topologia.
7. docs/requirements/FUNCTIONAL-REQUIREMENTS.md e USER-ROLES.md — o que construir.

## Como trabalhar (siga estritamente):
- Protocolo SOLID: cada módulo em domain/application/infrastructure/interface, com a
  dependência apontando para dentro (detalhes em AGENTS.md §3). Domínio não importa
  Nest, Postgres, Redis nem HTTP.
- Respeite os princípios não negociáveis (AGENTS.md §4): saldo de estoque derivado de
  livro imutável (nunca campo editável); Produto ≠ Lote; concorrência de reserva
  resolvida no banco (EXCLUDE + btree_gist); autorização papel×laboratório no servidor;
  auditoria append-only; exclusão = arquivamento; controlados com autenticação adicional.
- Ciclo por tarefa: Plano → Desenvolvimento → Teste → Verificação. Todo PR entra com
  testes (Vitest para domínio/uso; Playwright para fluxos críticos). PR sem teste não é aceito.
- Primeiro congele os CONTRATOS em packages/contracts (é o que destrava trabalho paralelo);
  só então implemente os adaptadores e a UI.
- Commits em Conventional Commits; um PR = uma unidade coesa.

## Comece pela Fase 1 (fundação), nesta sequência:
1. Contrato de identidade em packages/contracts (User, Laboratory, Project, Role,
   Membership) + o modelo RBAC papel×laboratório.
2. Escolha e configure a ferramenta de migração em packages/database e crie o schema
   base + auditoria imutável (AuditEvent append-only). Habilite a extensão btree_gist.
3. Scaffold real do NestJS em apps/api (saindo dos placeholders), com o módulo identity
   nas 4 camadas, autenticação (login local; ganchos para SSO/OIDC) e endpoint /health.
4. Scaffold real do Next.js em apps/web (PWA), com o shell mobile (navegação inferior +
   botão QR) e o shell desktop (estilo Slack), consumindo @arqueia/contracts.
5. CRUD de usuários/laboratórios/projetos a partir do contrato + seeds de dev.
Depois avance para a Fase 2 (estoque/ledger com QR e reservas com constraint de exclusão),
seguindo o ROADMAP.

## Ambiente Docker para DEV LOCAL (obrigatório) — ver ADR-006:
Crie um docker-compose.dev.yml na raiz para eu rodar e testar tudo localmente no
Docker Desktop, com estes serviços:
- postgres (imagem postgres:16) com a extensão btree_gist habilitada e volume persistente;
- redis (redis:7);
- api, web e worker rodando em container com hot-reload, lendo variáveis do .env.
Inclua um Dockerfile (ou target de dev) por app, um .dockerignore, um Makefile ou scripts
npm (ex.: "npm run dev:up" / "dev:down" / "dev:logs") e instruções no README.

IMPORTANTE — o Docker é APENAS para desenvolvimento local. A PRODUÇÃO é implantada de
forma NATIVA (sem Docker) na VM Debian com Apache2 + PM2, conforme ADR-001 e
docs/deployment/VM-DEPLOYMENT.md. Portanto:
- o código da aplicação NÃO pode depender de Docker;
- o mesmo `npm run build` deve funcionar tanto no container (dev) quanto nativo na VM (prod);
- mantenha paridade de versões (Node 20, Postgres 16, Redis 7) entre o compose e a VM;
- não altere o fluxo de deploy nativo (setup-vm.sh / deploy-vm.sh / vhost Apache2 / PM2).

## Ao terminar cada bloco:
Rode typecheck, lint, build e testes; garanta o CI verde; e faça a Verificação contra os
princípios não negociáveis antes de considerar a tarefa concluída.
```

---

> Este arquivo é apenas o texto do handoff; a autoridade das regras está em `AGENTS.md`
> e nos ADRs. Se algo no prompt conflitar com um ADR, o ADR prevalece.
