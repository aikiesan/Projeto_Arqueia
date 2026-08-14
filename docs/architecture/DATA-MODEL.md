# Modelo de Dados — Arqueia

Este documento descreve as **entidades centrais** e, principalmente, as **decisões de modelagem sensíveis**. Elas são de responsabilidade de Opus e devem estar estáveis antes do trabalho paralelo de implementação. Detalhes de colunas evoluem via migrações em `packages/database`.

Convenção: todas as tabelas operacionais têm `id`, `created_at`, `updated_at`, `archived_at` (soft-delete), e chaves de escopo (`laboratory_id`) quando aplicável.

---

## 0. Catálogo de referências e planejamento

- **CatalogSource** — versão de um levantamento externo, identificada por chave e hash SHA-256, sempre escopada a um laboratório.
- **CatalogSourceRow** — linha original append-only (`sheet_name`, `row_number`, `values`) para preservar a proveniência completa sem expor o conteúdo bruto pela API.
- **CatalogOption** — opção normalizada ligada à linha de origem: reagente, material, tipo/modelo de equipamento, espaço, bancada, mobiliário ou premissa de planejamento.

`CatalogOption` não representa existência física. A criação de `Product`, `Lot` ou `Equipment` exige confirmação humana e mantém a opção apenas como referência de origem. Ver [ADR-007](../decisions/ADR-007-reference-catalog.md).

---

## 1. Identidade e acesso

- **Institution** — instituição.
- **Laboratory** — pertence a uma instituição. Unidade de escopo de permissão.
- **User** — nome, e-mail institucional, instituição, supervisor. Credencial local e/ou vínculo SSO.
- **Project** — projeto de pesquisa; movimentações e reservas referenciam projeto (para consumo e custo).
- **Role** — `USUARIO | TECNICO | ADMIN | RESPONSAVEL_CONTROLADOS`.
- **Membership** — **(User × Laboratory × Role)**. É aqui que mora a autorização papel×laboratório. Um usuário tem N memberships.

> Decisão: permissão nunca é um booleano global no usuário. É sempre resolvida por `Membership` no laboratório do recurso alvo.

---

## 2. Estoque — livro-razão (a decisão mais importante)

### Produto ≠ Lote

- **Product** — identidade catalográfica: nome, fabricante, número CAS, classificação de risco, unidade base, categoria (reagente | consumível | solução preparada), flag `is_controlled`.
- **Lot** — instância física de um produto: `lot_code`, data de recebimento, data de abertura, data de validade, quantidade inicial, localização (laboratório → armário → prateleira), responsável pela compra, anexos (FDS/FISPQ).

Validade, recebimento e quantidade **pertencem ao lote**, não ao produto.

### StockMovement (livro imutável) — o saldo é derivado, nunca editado

```
StockMovement (append-only)
  id, lot_id, type, quantity_delta, unit,
  balance_before, balance_after,
  user_id, project_id, purpose,
  occurred_at, source (ex.: 'qr-web', 'manual', 'ajuste'),
  reason (para ajustes), created_at
  type ∈ { ENTRADA, RETIRADA, AJUSTE, DESCARTE, TRANSFERENCIA }
```

- O **saldo atual de um lote = soma dos `quantity_delta`** do seu livro. Não existe coluna "quantidade_atual" editável como fonte de verdade (pode existir uma projeção/cache **derivada** e recalculável).
- Cada movimento grava `balance_before`/`balance_after` para conferência e para o registro de controlados (FR-CTL-3).
- Correções são **novos movimentos** (`AJUSTE`/`DESCARTE`) com justificativa — nunca `UPDATE`/`DELETE` de movimentos passados.
- Retirada por embalagem (unidade/pacote/caixa) converte para a unidade base do produto no momento do movimento.

### PreparedSolution (FR-EST-7)

Especialização de produto (`categoria = solução preparada`) com: responsável pelo preparo, data, concentração, validade, **referências aos lotes consumidos** (rastreabilidade experimental) e protocolo. Consumir reagentes para preparar uma solução gera `RETIRADA` nos lotes de origem e cria o novo lote da solução.

---

## 3. Equipamentos

- **Equipment** — ativo físico confirmado, sempre escopado ao laboratório. Referencia uma opção de tipo/modelo do catálogo e, opcionalmente, opções de espaço e bancada do mesmo laboratório.
- Código, patrimônio, número de série, responsável e status pertencem ao equipamento operacional, nunca à opção de catálogo.
- A política mínima de reserva guarda duração máxima, exigência de treinamento/aprovação e janela de ausência. Conflitos não são resolvidos nessa entidade: o banco os impede em `Reservation`, conforme ADR-005.
- Cadastro e alteração exigem `equipment.manage`, geram auditoria na mesma transação e usam arquivamento em vez de exclusão física.

## 4. Controlados

Reutiliza `Product`/`Lot`/`StockMovement`, com:

- **CustodyEvent** — vinculado ao `StockMovement` de um lote controlado: autorizador, método de autenticação (senha do responsável / aprovação por celular), justificativa, anexos. Compõe a **cadeia de custódia** (FR-CTL-3).
- Regra: um `StockMovement` do tipo `RETIRADA` em lote de produto `is_controlled = true` **exige** um `CustodyEvent` válido na mesma transação; caso contrário, a transação falha.
- O "livro digital" (FR-CTL-4) é uma **view/export** sobre `StockMovement + CustodyEvent`, com marcação de status regulatório (rascunho até validação formal).

---

## 4. Equipamentos

- **Equipment** — nome, modelo, localização, status (`DISPONIVEL | EM_AVALIACAO | INDISPONIVEL`), responsável (técnico), características.
- **EquipmentDocument** — POP, manual, FDS, vídeo, procedimento de emergência. **Versionado**: `version`, `author_id`, `valid_until`, `file_ref`.
- **EquipmentRule** — regras por equipamento: `max_reservation_hours`, `training_required`, `technician_approval_required`, `checkin_window_minutes`. Implementadas como estratégias (aberto/fechado — SOLID "O").
- **Qualification** — **(User × Equipment)**: habilitado sim/não, data, treinador. Bloqueia reserva se `training_required` e não habilitado (FR-EQP-3).
- **TrainingRequest** — solicitação → aprovação → agendamento → habilitação (FR-EQP-4).
- **MaintenanceRecord** — preventiva/corretiva, troca de peça, data, descrição.
- **CalibrationRecord** — última e próxima calibração; alimenta alertas.
- **IncidentReport** — reporte de problema (FR-EQP-5): categoria, descrição, foto; pode transicionar o status do equipamento.

---

## 5. Agenda / Reservas — concorrência no banco

- **Reservation** — equipamento, usuário, projeto, `time_range` (intervalo), descrição, nº de amostras, observações, status (`AGENDADA | CHECKED_IN | LIBERADA | CANCELADA | CONCLUIDA`).
- **Concorrência (ADR-005):** conflitos de horário são impedidos por uma **constraint de exclusão** no Postgres sobre `(equipment_id, time_range)` usando `tstzrange` + `EXCLUDE USING gist`. Duas reservas sobrepostas no mesmo equipamento **não podem coexistir** — a garantia é do banco, não da UI.
- **RecurrenceRule** — não repete/diária/semanal/quinzenal/mensal/personalizado; expande em ocorrências. Ao criar recorrência, cada ocorrência é validada contra a constraint; as conflitantes são reportadas e as livres, criadas (FR-AGD-3).
- **Check-in / liberação (FR-AGD-5):** se não houver check-in dentro de `checkin_window_minutes`, o worker transiciona para `LIBERADA`.
- **TechnicalBlock** — bloqueios (manutenção/calibração) ocupam a agenda como indisponibilidade.

---

## 6. Multiusuário

- **ExternalRequest** — dados do solicitante (sem conta), equipamento, data/horário desejados, amostras, tipo de análise, observações; status do workflow (FR-MUS-3).
- **AccessToken** — token **não sequencial** para acompanhamento por link (FR-MUS-4); expira; escopo restrito à própria solicitação.
- **RequestMessage** — comunicação (pedido de informações adicionais, etc.).

---

## 7. Transversal: auditoria e documentos

- **AuditEvent (append-only)** — `actor_id`, `action`, `entity`, `entity_id`, `before` (jsonb), `after` (jsonb), `origin`, `occurred_at`. Gravado para toda ação sensível. **Imutável**: sem update/delete.
- **Notification** — canal (app/e-mail), destinatário, tipo, payload, status de envio; produzida pelo worker.
- **Document (genérico)** — quando aplicável a itens além de equipamento; sempre versionado (autor, data, validade).

---

## 8. Invariantes de banco (checar em migrações e testes)

1. Não há coluna de saldo editável como fonte de verdade; saldo = agregação de `StockMovement`.
2. `RETIRADA` de lote controlado ⇒ `CustodyEvent` na mesma transação.
3. `EXCLUDE` de sobreposição de `Reservation` por equipamento.
4. `AuditEvent` e `StockMovement` são append-only (sem UPDATE/DELETE).
5. Soft-delete (`archived_at`) em dados operacionais; nada é apagado fisicamente.
6. Todo recurso escopável carrega `laboratory_id` para a decisão de autorização.
