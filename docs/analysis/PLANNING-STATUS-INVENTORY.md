# Inventário e Status dos Planos do Projeto Arqueia

Este documento consolida o status atual de cada um dos 16 documentos de planejamento existentes em `docs/plan/`, alinhando-os ao plano canônico **[SYSTEM-CONTINUOUS-IMPROVEMENT.md](file:///a:/Projeto_Arqueia/docs/plan/SYSTEM-CONTINUOUS-IMPROVEMENT.md)**.

---

## 1. Mapeamento e Status Atual

| Arquivo de Plano | Categoria | Status | Observações / Próximo Passo |
|---|---|:---:|---|
| `SYSTEM-CONTINUOUS-IMPROVEMENT.md` | **Canônico Mestre** | **ATIVO** | Índice único de priorização (E0 a E9). |
| `ROADMAP.md` | Estratégia | **ATIVO** | Visão macro de longo prazo do produto. |
| `F1-IDENTITY-CONTRACT.md` | Fundação | **CONCLUÍDO** | Contratos de identidade em `@arqueia/contracts`. |
| `F1-ACCESS-ASSIGNMENT-CONTRACT.md` | Fundação | **CONCLUÍDO** | Atribuição de permissões e reautenticação. |
| `F1-CP2b-REFERENCE-CATALOG.md` | Fundação | **CONCLUÍDO** | Catálogo e seeds de referência do CP2b. |
| `F1-LOCAL-FOUNDATION-VERIFICATION.md` | Fundação | **CONCLUÍDO** | Docker dev, PostgreSQL, Redis e Monorepo. |
| `F2-EQUIPMENT-REGISTRATION.md` | Módulo | **CONCLUÍDO** | Cadastro básico e listagem de equipamentos. |
| `EQUIPMENT-REGISTRY-DEVELOPMENT.md` | Módulo | **CONCLUÍDO** | Interface e modais de equipamento. |
| `HOME-DASHBOARD-DEVELOPMENT.md` | Interface | **CONCLUÍDO** | Home dashboard e smoke tests 390px/1440px. |
| `GUIDE-OPERATIONAL-DEVELOPMENT.md` | Interface | **CONCLUÍDO** | Página `/guia` de apoio operacional. |
| `MANAGEMENT-ANALYTICS-DEVELOPMENT.md` | Gestão | **SUPERSEDIDO** | Substituído por `MANAGEMENT-DEVELOPMENT.md`. |
| `MANAGEMENT-DEVELOPMENT.md` | Gestão | **EM EXECUÇÃO (E1)** | E1.1 e E1.2 (consultas set-based no Postgres) concluídos. |
| `INTERACTION-UX-DEVELOPMENT.md` | UX / UI | **ATIVO (UX0/UX1)** | UX0 (Tokens/Feedback) e UX1 (Edição Inline) pilotados. |
| `SCHEDULING-RESERVATIONS-DEVELOPMENT.md` | Agenda | **PENDENTE (E3.2/E7)** | Exclusão no banco e motor de concorrência. |
| `TASK-ORCHESTRATION.md` | Governança | **OPERACIONAL** | Regras de orquestração Opus vs Haiku. |
| `CLAUDE-CODE-HANDOFF.md` | Governança | **OPERACIONAL** | Handover e diretrizes de desenvolvimento. |

---

## 2. Resumo por Fase do Plano Canônico

### 🟢 Concluído / Verificado (E0 & E1 parcial)
- **E0 (Baseline Confiável):** 131/131 testes passando, CI reproduzível, `typecheck`, `lint` e `build` limpos, smoke tests responsivos.
- **E1 (Gestão Endurecida - M3):** Agregações set-based em SQL (2 queries em `getProjectUsage`), eliminação do laço N+1, isolamento por laboratório e sanitização de auditoria.
- **E2.1 (Segurança & Sessões):** ADR 008 publicada congelando a arquitetura de tokens, MFA e OIDC.

### 🟡 Em Andamento / Próximos Incrementos
- **E2.2 (Segurança em Código):** Rotação de refresh token, invalidação no logout, reautenticação e rate limit.
- **E3 (MVP Operacional Completo):** Validação real de ledger de estoque e concorrência de reservas no PostgreSQL + Playwright e2e.
- **E4 (Qualidade UX & PWA):** Expansão das diretrizes do `INTERACTION-UX-DEVELOPMENT.md` para Estoque (UX2) e Agenda (UX3).
