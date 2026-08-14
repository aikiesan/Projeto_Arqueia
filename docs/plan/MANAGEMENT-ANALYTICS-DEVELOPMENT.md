# Plano — Módulo de Gestão, Analytics Operacional e Livro de Auditoria (/gestao)

## 1. Objetivo

Implementar o módulo completo de **Gestão, Analytics Operacional e Livro de Auditoria Sanitizado** (`/gestao`), integrando métricas reais de uso de equipamentos, consumo de insumos derivados do livro-razão de movimentações (`stock_movements`) e a timeline auditável imutável (`audit_events`).

---

## 2. Contratos e Regras Não Negociáveis

1. **Preservação da Home Autenticada**:
   - `dashboardSummarySchema` em `packages/contracts/src/management/dashboard.ts` permanece **intacto**.
2. **Contratos Segregados**:
   - `analytics.ts`: `managementAnalyticsQuerySchema` (escopo obrigatório `laboratoryId`, `startsAt`, `endsAt` em intervalo semiaberto `[startsAt, endsAt)` com limite de 90 dias).
   - `audit.ts`: `listAuditLogsQuerySchema` (com suporte a cursor e ordenação por `occurredAt DESC, id DESC`), `auditLogSummarySchema` (suportando `actorId` nulo para eventos de sistema), `auditLogDetailSchema` (sanitizado por allowlist).
3. **Métricas Estritamente Reais no PostgreSQL**:
   - **Equipamentos Ativos**: `archived_at IS NULL AND laboratory_id = $1`.
   - **Horas Reservadas**: Soma exata de `EXTRACT(EPOCH FROM (LEAST(ends_at, $endsAt) - GREATEST(starts_at, $startsAt))) / 3600` para ocupações do tipo `RESERVATION` com status `CONFIRMED`, `ACTIVE` ou `COMPLETED`.
   - **Saldo Derivado de Lotes e Insumos**:
     `SUM(CASE WHEN movement_type IN ('ENTRY', 'ADJUSTMENT') THEN quantity WHEN movement_type IN ('WITHDRAWAL', 'DISCARD') THEN -quantity ELSE 0 END) > 0`
   - **Alertas de Validade (30 dias)**: Validade calculada com base no timezone do laboratório (`America/Sao_Paulo`).
   - **Consumo por Projeto**: Apresentação de horas e insumos discriminados por `productId` e `unitOfMeasure`, **sem misturar grandezas físicas distintas**.
4. **Sanitização Fail-Closed por Allowlist**:
   - Omitir qualquer campo não mapeado na allowlist.
   - Reduzir e proibir rigorosamente senhas, hashes, tokens, segredos e dados binários.
5. **Paginação por Cursor de Auditoria**:
   - Keyset pagination utilizando `(occurred_at, id) < (SELECT occurred_at, id FROM audit_events WHERE id = $cursor)`.

---

## 3. Reparos nos Bloqueadores SQL e Repositorio

- **Projetos**: Tabela `projects` consulta por `laboratory_id = $1` (coluna `institution_id` não existe).
- **Ocupações de Equipamento**: Junção de `reservations` com `equipment_occupations` por `equipment_id`, `starts_at` e `ends_at`.
- **Contagem de Lotes**: Subqueries envelopadas `SELECT COUNT(*) FROM (...) sub` em consultas com `HAVING`.
- **Retiradas por Projeto**: Contagem independente de movimentações do tipo `WITHDRAWAL`.
- **Actor Nulo**: `actorId` nulo tratado graciosamente no schema Zod e na interface.

---

## 4. Testes e Verificação

- Testes de integração reais contra container efêmero de PostgreSQL.
- Validação no BFF com `Zod.parse()`.
- Resiliência na UI com `Promise.allSettled` ou chamadas independentes.
- Respeito ao parâmetro `?laboratory=` na URL do frontend.
- `npm run lint` e `npm test` limpos e aprovados.
