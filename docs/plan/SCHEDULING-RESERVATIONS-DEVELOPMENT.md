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
