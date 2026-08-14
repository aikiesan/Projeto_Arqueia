# Arqueia

**Plataforma integrada de gestão, rastreabilidade e compartilhamento de infraestrutura laboratorial.**

Arqueia não é "um app para reservar equipamento". É o sistema operacional do laboratório: conecta a cadeia completa

```
Pessoa → Projeto → Insumo/Lote → Equipamento → Reserva/Análise → Registro → Custo
```

de forma auditável e implantável. O primeiro uso é o NIPE/CP2b (Unicamp), mas o modelo de dados e as permissões são desenhados para múltiplos laboratórios e, futuramente, redes inteiras de infraestrutura científica.

---

## Os 6 módulos

| Módulo | Escopo |
|---|---|
| 🧪 **Estoque** | Reagentes, materiais de consumo, lotes, validade, QR Code, livro de movimentação e consumo. |
| 🔐 **Controlados** | Acesso restrito, retirada com autenticação adicional, cadeia de custódia e rastreabilidade completa. |
| 🔬 **Equipamentos** | Cadastro, QR Code, POPs/documentos, habilitação/treinamento, manutenção, calibração e status. |
| 📅 **Agenda** | Reservas normais e recorrentes, regras por equipamento, conflitos, bloqueios e check-in. |
| 🌐 **Multiusuário** | Portal externo de solicitação de análises/uso sem necessidade de cadastro, com workflow por token. |
| 📊 **Gestão** | Dashboard, relatórios (Excel/PDF), consumo, custos por projeto, alertas e histórico. |

O detalhamento funcional de cada módulo (as 24 funcionalidades da visão original) está em [`docs/requirements/FUNCTIONAL-REQUIREMENTS.md`](docs/requirements/FUNCTIONAL-REQUIREMENTS.md).

---

## Princípios de produto (não negociáveis)

Estas decisões definem a diferença entre um protótipo e um sistema operacional de laboratório. Estão detalhadas nos ADRs em [`docs/decisions/`](docs/decisions/).

- **Saldo de estoque é derivado de um livro de movimentações imutável**, nunca um campo editável. (`ADR-004`)
- **Produto e Lote são entidades separadas.** Validade, recebimento e quantidade pertencem ao lote.
- **Reservas concorrentes são bloqueadas no banco**, não apenas na interface. (`ADR-005`)
- **Permissão considera papel × laboratório**: um técnico administra o seu laboratório sem administrar o sistema inteiro.
- **Alterações sensíveis geram eventos de auditoria não editáveis** (ator, data, origem, valores antes/depois).
- **Exclusão operacional é arquivamento**, preservando histórico.
- **Documentos têm versão, autor e validade.**
- **O "livro digital" de controlados não é considerado juridicamente válido antes da validação formal** pelo responsável regulatório.

---

## Stack (produção nativa; Docker apenas no desenvolvimento)

Monorepo TypeScript, executado nativamente na VM Debian via **PM2/systemd** (a VM não roda Docker — ver `ADR-001`). O desenvolvimento local usa Docker Compose exclusivamente como ambiente reproduzível (`ADR-006`); o código e o build não dependem de contêineres.

- **Frontend / PWA:** Next.js (mobile-first para operação, desktop-first para gestão)
- **API:** NestJS (modular, camadas SOLID)
- **Worker:** processador de filas para notificações, alertas e relatórios
- **Banco transacional:** PostgreSQL
- **Filas / cache:** Redis
- **Documentos/imagens:** volume institucional (S3-compatível opcional no futuro)
- **Proxy reverso + TLS:** Apache2 já existente na VM (`ADR-002`)
- **Testes:** Vitest + Testing Library + Playwright
- **CI:** GitHub Actions

### Desenvolvimento local

Requisitos: Docker Desktop, Node 20 e npm 10. Na raiz:

```bash
cp .env.example .env
npm install
npm run dev:config
npm run dev:up
npm run dev:logs
```

No PowerShell, use `Copy-Item .env.example .env` no primeiro comando. Web/PWA fica em
`http://localhost:4002` e a API em `http://localhost:4001`; o health check é
`GET /health`. Migrações e seed de desenvolvimento:

```bash
docker compose -f docker-compose.dev.yml exec api npm run db:migrate
docker compose -f docker-compose.dev.yml exec api npm run db:seed
```

Detalhes, persistência dos volumes e solução de problemas estão em
[`docs/deployment/LOCAL-DEVELOPMENT.md`](docs/deployment/LOCAL-DEVELOPMENT.md). O deploy
da VM permanece o fluxo nativo documentado em
[`docs/deployment/VM-DEPLOYMENT.md`](docs/deployment/VM-DEPLOYMENT.md).

---

## Mapa do repositório

```
Projeto_Arqueia/
├─ apps/
│  ├─ web/          # Next.js — PWA responsivo (operação mobile + gestão desktop)
│  ├─ api/          # NestJS — API modular por domínio
│  └─ worker/       # Filas: notificações, alertas, relatórios
├─ packages/
│  ├─ contracts/    # Tipos e contratos compartilhados (DTOs, schemas) — fonte da verdade
│  ├─ database/     # Schema, migrações, seeds, repositórios
│  ├─ ui/           # Design system compartilhado
│  └─ config/       # ESLint, TS, env, presets compartilhados
├─ infrastructure/
│  ├─ proxy/        # VirtualHost Apache2 (arqueia.cp2b.unicamp.br)
│  ├─ pm2/          # ecosystem.config.js (api, web, worker)
│  └─ scripts/      # setup-vm.sh, deploy-vm.sh
├─ docs/
│  ├─ architecture/ # Arquitetura, modelo de dados, segurança
│  ├─ requirements/ # Requisitos funcionais e papéis/permissões
│  ├─ decisions/    # ADRs (registros de decisão de arquitetura)
│  ├─ deployment/   # Runbook de implantação na VM + ambientes
│  └─ plan/         # Roadmap em fases + matriz de orquestração Haiku/Opus
├─ tests/           # Testes end-to-end e de integração cross-app
├─ .github/workflows/
└─ AGENTS.md        # Convenções para desenvolvimento assistido por IA
```

---

## Por onde começar

1. Leia [`docs/plan/ROADMAP.md`](docs/plan/ROADMAP.md) — as fases e o que entra em cada uma.
2. Leia [`docs/plan/TASK-ORCHESTRATION.md`](docs/plan/TASK-ORCHESTRATION.md) — quem faz o quê (Claude Haiku vs Opus) e o que roda em paralelo.
3. Leia [`AGENTS.md`](AGENTS.md) — as convenções obrigatórias antes de escrever qualquer código.
4. Consulte os ADRs em [`docs/decisions/`](docs/decisions/) antes de contestar uma decisão de arquitetura.

> **Estado atual:** Fase 1 — fundação em implementação. Contratos de identidade/RBAC,
> schema base, auditoria append-only, autenticação local, API NestJS, PWA Next.js,
> worker e ambiente Docker de desenvolvimento já possuem implementação inicial.
