# Plano — Agenda, Reservas e Bloqueios

## Objetivo

Entregar uma agenda operacional para equipamentos do CP2b com visualizações Dia/Semana/Mês, criação e cancelamento de reservas e bloqueios técnicos, garantindo no PostgreSQL que horários incompatíveis nunca se sobreponham.

## Princípios obrigatórios

- Concorrência resolvida no banco com `tstzrange`, `btree_gist` e `EXCLUDE USING gist`.
- Toda consulta e mutação é escopada por laboratório no servidor.
- Reserva referencia entidades reais: equipamento, usuário e projeto.
- Exclusão operacional é cancelamento/arquivamento, nunca remoção física.
- Criação, cancelamento, aprovação e bloqueio gravam auditoria append-only.
- Datas são persistidas com timezone; apresentação usa o timezone do laboratório.
- A UI pode antecipar conflitos, mas nunca é a garantia final.

## Escopo do MVP

- Calendário Dia, Semana e Mês.
- Filtros por laboratório, equipamento, status e “minhas reservas”.
- Criar reserva única com projeto, finalidade, número de amostras e observações.
- Respeitar duração máxima e política inicial do equipamento.
- Detectar conflito atômico e retornar mensagem clara.
- Cancelar a própria reserva; técnico/admin pode cancelar conforme RBAC.
- Criar bloqueio técnico de manutenção ou calibração.
- Painel de detalhes da reserva/bloqueio.
- Mobile: lista cronológica + ação rápida; desktop: grade de calendário e painel contextual.

## Depois do MVP

- Recorrência e conflitos por ocorrência.
- Aprovação técnica.
- Habilitação e solicitação de treinamento.
- Check-in, conclusão e liberação por ausência.
- Lembretes pelo worker.

## Contratos-âncora

Antes de adaptadores ou UI, congelar em `packages/contracts`:

- `Reservation`, `ReservationStatus` e `ReservationTimeRange`;
- `TechnicalBlock` e `TechnicalBlockReason`;
- inputs de criar/cancelar reserva e criar/cancelar bloqueio;
- consulta de agenda por laboratório, intervalo, equipamento e usuário;
- resposta de conflito segura, com código estável e sem detalhes sensíveis de outra reserva;
- permissões `scheduling.reservation.*` e `scheduling.block.*` no RBAC.

## Checkpoints curtos

### A1 — Contrato e regras puras

- Definir schemas e estados.
- Validar início < fim, limites e campos obrigatórios.
- Definir matriz de permissões e transições permitidas.
- Testar timezone, intervalos e transições.

**Aceite:** contratos congelados e testes unitários verdes.

### A2 — Banco e concorrência

- Criar nova migração, sem editar migrações aplicadas.
- Tabelas de reservas e bloqueios com auditoria e arquivamento.
- Implementar a constraint de exclusão para ocupações ativas do mesmo equipamento.
- Modelar reservas e bloqueios em uma estratégia que garanta conflito entre ambos no banco.
- Testar duas gravações concorrentes no PostgreSQL real.

**Aceite:** exatamente uma tentativa concorrente vence; a outra recebe conflito controlado.

### A3 — Casos de uso e API

- `ListSchedule`, `CreateReservation`, `CancelReservation`, `CreateTechnicalBlock` e `CancelTechnicalBlock`.
- Controllers finos, DTOs vindos dos contratos e repositórios Postgres.
- Transação única para mutação + `AuditEvent`.
- Mapear violação da constraint para HTTP `409` com código estável.

**Aceite:** API segura, auditável e isolada por laboratório.

### A4 — BFF e calendário somente leitura

- Rotas BFF preservando cookie HttpOnly.
- Página `/agenda` com Dia/Semana/Mês e filtros.
- Estados vazio, carregamento e erro.
- Cores distintas para reserva própria, reserva de terceiros e bloqueio técnico, sem revelar dados proibidos.

**Aceite:** usuário visualiza a ocupação permitida no desktop e mobile.

### A5 — Criar e cancelar reservas

- Fluxo em etapas curtas: equipamento → horário → projeto e finalidade → confirmação.
- Exibir política do equipamento antes da confirmação.
- Mensagem de conflito com sugestão para escolher outro horário.
- Detalhes e cancelamento conforme permissão.

**Aceite:** reserva criada aparece imediatamente; conflito nunca gera sobreposição.

### A6 — Bloqueios técnicos

- Técnico/admin cria bloqueios para manutenção e calibração.
- Bloqueio aparece na mesma linha temporal das reservas.
- Cancelamento exige permissão e gera auditoria.

**Aceite:** bloqueio impede novas reservas no intervalo e não pode ser criado sobre ocupação incompatível.

### A7 — Verificação do MVP

- Playwright: criar reserva, conflito entre dois usuários, cancelar e criar bloqueio.
- Integração Postgres para concorrência e isolamento entre laboratórios.
- QA responsivo e acessibilidade básica do calendário.
- Typecheck, lint, testes e build; revisão do domínio crítico.

## Segurança e privacidade

- Limitar intervalos e paginação para evitar consultas abusivas.
- Validar UUIDs, enums, textos e tamanhos com schemas estritos.
- SQL sempre parametrizado.
- Mensagens de conflito não revelam finalidade, projeto ou observações de terceiros sem permissão.
- Rate limit nas mutações e logs sem tokens, senhas ou observações sensíveis.

## Definição de pronto

Usuários autorizados conseguem consultar e reservar equipamentos; técnicos conseguem bloquear períodos; conflitos são impossíveis no banco; todas as mutações são auditadas; e os fluxos críticos funcionam no Docker em desktop e mobile.

---

## Auditoria da implementação existente — 2026-08-14

A implementação atual é uma prova funcional, mas ainda não satisfaz este plano como núcleo
operacional. Os seguintes pontos são bloqueadores para considerar o módulo pronto:

1. A página ignora `?laboratory=<uuid>` e prefere o código `CP2b` no cliente.
2. Dia, semana, mês, campos de formulário e recorrência usam o timezone do navegador/UTC, não
   `laboratories.timezone`.
3. A UI decide ações privilegiadas examinando os nomes `ADMIN` e `TECNICO`; capacidades devem
   vir prontas do servidor.
4. Cancelamentos autorizam o `laboratoryId` não validado da query string e depois localizam o
   registro somente pelo ID. Isso permite confusão de escopo entre laboratórios.
5. `z.coerce.boolean()` interpreta a string `"false"` como verdadeira.
6. A consulta de calendário não limita duração do intervalo nem quantidade de itens retornados.
7. O filtro de exceções produz `null` onde o contrato de conflito exige timestamps válidos.
8. A criação não confirma que o projeto está ativo e pertence ao mesmo laboratório.
9. Recorrências usam dias UTC e uma transação independente por ocorrência, permitindo sucesso
   parcial sem um contrato explícito de atomicidade.
10. Não existem testes do `PostgresSchedulingRepository` contra PostgreSQL real, nem testes de
    controller/BFF/fluxo da Agenda.
11. O BFF encaminha payloads sem validar as respostas com os schemas compartilhados.
12. Políticas `requiresTraining` e `requiresApproval` são exibidas, mas ainda não são aplicadas
    pelo backend.

## Decisões congeladas para o MVP endurecido

### Contexto e tempo

- O laboratório ativo segue `?laboratory=<uuid>` quando autorizado; nunca é selecionado por
  código ou nome fixo.
- O servidor retorna o identificador IANA de `laboratories.timezone` em toda resposta de agenda.
- Todo intervalo é semiaberto: `[startsAt, endsAt)`.
- Uma ocupação participa da consulta quando `occupation.starts_at < endsAt` e
  `occupation.ends_at > startsAt`.
- Dia é `[D 00:00, D+1 00:00)` no timezone do laboratório.
- Semana começa na segunda-feira e contém sete dias civis nesse timezone.
- Mês consulta os 42 dias visíveis da grade, incluindo dias adjacentes.
- Uma consulta cobre no máximo 42 dias e retorna no máximo 1.000 itens. Exceder o limite gera
  erro explícito; dados nunca são truncados silenciosamente.

### RBAC e privacidade

| Intenção | Permissão de servidor | Regra |
| --- | --- | --- |
| Ver ocupação | `equipment.read` | Pode ver horário, equipamento e estado público. |
| Criar reserva | `scheduling.reserve` | Reserva sempre pertence ao ator autenticado. |
| Cancelar reserva própria | `scheduling.cancel` | Exige antecedência mínima contratual. |
| Gerenciar reservas de terceiros | `scheduling.approve` | Pode cancelar no laboratório autorizado. |
| Criar/cancelar bloqueio | `scheduling.block.manage` | Somente no laboratório autorizado. |

- O cliente recebe `capabilities` e `canCancel` calculados no servidor; nunca interpreta papéis.
- Reserva de terceiro expõe apenas “equipamento reservado”, intervalo, equipamento e status.
  Projeto, usuário, finalidade, amostras e observações são privados.
- Detalhes técnicos e autor de bloqueio são expostos apenas a quem possui
  `scheduling.block.manage`.
- “Não encontrado” é usado também para IDs fora do laboratório autorizado, evitando enumeração.

### Criação, cancelamento e estados

- Equipamento e projeto devem existir, não estar arquivados e pertencer ao laboratório informado.
- O projeto deve estar `ACTIVE`.
- Reserva única dura no mínimo 30 minutos e no máximo
  `equipment.max_reservation_minutes`.
- Equipamento precisa estar `AVAILABLE`.
- Reservas no passado são rejeitadas pelo caso de uso com relógio injetável/testável.
- Cancelamento é escopado por `(laboratory_id, reservation_id)` ou
  `(laboratory_id, technical_block_id)` dentro da transação.
- Repetir um cancelamento já confirmado é idempotente e não grava auditoria duplicada.
- Recorrência permanece fora do MVP endurecido. A UI não a oferece até existir contrato de
  timezone, série, edição de ocorrência e atomicidade/sucesso parcial.
- `requiresTraining` e `requiresApproval` permanecem fail-closed para usuários comuns até a
  modelagem das habilitações e aprovações. Técnicos com permissão de aprovação não ignoram essa
  decisão silenciosamente; qualquer exceção deverá ser auditada por contrato futuro.

### Concorrência, auditoria e erros

- Reserva e bloqueio usam a mesma linha temporal em `equipment_occupations`.
- A constraint `equipment_occupations_no_overlap_excl` é a autoridade final para conflitos.
- Criação/cancelamento e `audit_events` acontecem na mesma transação.
- Conflito retorna HTTP `409`, código `RESERVATION_SLOT_CONFLICT` e somente o intervalo solicitado;
  nunca revela o intervalo ou os detalhes da ocupação concorrente.
- Códigos de domínio são estáveis e validados pelo BFF antes de chegar à UI.

## Sequência revisada

1. **A1.1 — Contrato endurecido:** intervalo máximo, booleanos estritos, timezone, capacidades,
   cancelamento com laboratório e respostas limitadas.
2. **A1.2 — Adaptação vertical:** casos de uso, controller, repositório e BFF compilando contra o
   contrato congelado, sem inferência de papel no cliente.
3. **A2 — PostgreSQL real:** nova migração apenas se necessária; testes com dois laboratórios,
   projeto cruzado, reserva × reserva e reserva × bloqueio concorrentes.
4. **A3 — UI temporal:** utilitários IANA testados, URL do laboratório, grade de 42 dias e estados
   acessíveis mobile/desktop.
5. **A4 — Fluxos críticos:** Playwright e QA de criar, conflitar, cancelar e bloquear.
