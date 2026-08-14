# Plano canônico — Gestão, Analytics e Auditoria (`/gestao`)

## 1. Status, objetivo e precedência

**Status:** proposta para aprovação. Nenhum checkpoint de implementação começa antes da aprovação explícita deste documento.

Este plano corrige e conclui o módulo de Gestão sem misturar o escopo futuro de custos e exportações. Ele substitui, como fonte canônica, `docs/plan/MANAGEMENT-ANALYTICS-DEVELOPMENT.md`, que deve ser tratado apenas como registro histórico após a aprovação.

Objetivos desta entrega:

1. tornar indicadores e períodos matematicamente inequívocos;
2. usar o timezone configurado no laboratório, nunca o timezone do navegador nem uma constante CP2b;
3. eliminar consultas N+1 e respostas sem limite;
4. aplicar autorização papel × laboratório de forma independente para analytics e auditoria;
5. restringir o responsável por controlados ao menor privilégio;
6. garantir paginação estável, sanitização fail-closed e isolamento entre laboratórios;
7. criar testes reais do adaptador PostgreSQL;
8. resolver a situação das migrações sem reescrever histórico aplicado;
9. tornar `/gestao` resiliente a permissões e falhas parciais.

Custos por projeto, Excel e PDF não fazem parte desta entrega. Estão especificados como tarefa posterior em M6.

---

## 2. Evidência do estado atual

Antes de implementar, o responsável pelo checkpoint deve reconfirmar no código e nos ambientes:

- `packages/contracts/src/management/analytics.ts` ainda retorna `projectSummaries` sem página própria;
- `packages/contracts/src/management/audit.ts` ainda aceita cursor UUID, em vez de cursor opaco versionado;
- `apps/api/src/modules/management/infrastructure/postgres-management-repository.ts` ainda executa consultas por projeto;
- o atalho “Hoje” em `apps/web/app/gestao/management-page-client.tsx` ainda deriva o início do dia no navegador;
- a consulta de validade ainda contém `America/Sao_Paulo` fixo;
- `RESPONSAVEL_CONTROLADOS` ainda recebe `audit.read` genérico;
- o banco de cada ambiente pode divergir quanto à aplicação da migração `006_management_audit_indexes`;
- o workspace pode não conter metadados Git acessíveis.

Correções já presentes devem ser preservadas, mas novamente cobertas por testes: ator de sistema nullable, contagem real de lotes, saldo com ajuste, projeto escopado ao laboratório, chamadas independentes na UI e sanitização inicial.

---

## 3. Contratos congelados

### 3.1 Intervalo temporal

Todo intervalo de analytics e auditoria é semiaberto:

```text
[startsAt, endsAt) = { t | startsAt <= t < endsAt }
```

Regras:

- `startsAt` e `endsAt` são instantes ISO 8601 com offset explícito, normalizados para UTC na resposta;
- `endsAt > startsAt`;
- duração máxima: `90 × 24 horas`, medida entre os instantes;
- registros exatamente em `startsAt` entram; registros exatamente em `endsAt` não entram;
- o timezone não altera instantes explícitos, apenas a conversão de datas civis e atalhos como “Hoje”.

### 3.2 Timezone do laboratório

`laboratories.timezone` é a única fonte do timezone civil. A API deve carregar o laboratório solicitado, validar que está ativo e validar o identificador IANA antes de calcular datas locais.

Para um laboratório com timezone `Z` e instante atual `N`:

```text
todayLocal = data civil de N em Z
today.startsAt = início de todayLocal em Z, convertido para UTC
today.endsAt = N
```

O frontend não usa `setHours(0, 0, 0, 0)` para “Hoje”. A conversão deve ficar em uma função compartilhada e testável, baseada em uma biblioteca timezone-aware aprovada ou em resolução no servidor. Não é permitido calcular com o timezone do navegador.

Casos obrigatórios de teste:

- `America/Sao_Paulo`;
- um laboratório em outro timezone;
- fronteira de meia-noite;
- transição de horário de verão em timezone que a possua;
- instante exatamente no fim do intervalo.

### 3.3 Validade em dias civis

Se `D0` é a data civil atual no timezone do laboratório e `Dv` é a data civil de validade no mesmo timezone:

```text
expiringWithin30Days = D0 <= Dv < D0 + 31 dias civis
```

Isso inclui lotes que vencem hoje e no trigésimo dia futuro. O indicador considera somente lote não arquivado, operacionalmente disponível e com saldo derivado maior que zero.

O SQL deve usar `laboratories.timezone`; é proibida constante `America/Sao_Paulo` no repositório de management. A UI exibe o timezone retornado pela API.

### 3.4 Fórmulas dos indicadores

Para o laboratório `L` e período `[S, E)`:

**Equipamentos não arquivados**

```text
totalActiveEquipment = COUNT(equipment)
WHERE laboratory_id = L AND archived_at IS NULL
```

“Ativo” significa “não arquivado”, não significa “disponível”. A UI deve usar o rótulo “equipamentos cadastrados ativos” ou o contrato deve ser renomeado para eliminar ambiguidade.

**Horas reservadas**

Para cada ocupação de reserva não cancelada que sobreponha `[S, E)`:

```text
overlapHours = max(0, min(ends_at, E) - max(starts_at, S)) / 1 hora
totalReservedHours = arredondar_1_decimal(SUM(overlapHours))
reservationCount = COUNT(DISTINCT reservation.id)
```

Entram ocupações `CONFIRMED`, `ACTIVE` e `COMPLETED`; `CANCELLED` não entra. O campo atual `confirmedReservationCount` deve ser renomeado para `reservationCount`, pois inclui estados além de confirmado.

**Saldo derivado do lote**

Como `ADJUSTMENT.quantity` armazena delta assinado:

```text
batchBalance =
  SUM(ENTRY.quantity)
  + SUM(ADJUSTMENT.quantity)
  - SUM(WITHDRAWAL.quantity)
  - SUM(DISCARD.quantity)
```

É proibido usar `batches.initial_quantity` ou um campo editável como saldo atual.

**Lotes ativos com saldo**

```text
totalActiveBatches = COUNT(batch)
WHERE batch.laboratory_id = L
  AND batch.archived_at IS NULL
  AND batch.status = 'AVAILABLE'
  AND batchBalance > 0
```

**Produtos abaixo do mínimo**

```text
productBalance = SUM(batchBalance dos lotes não arquivados e não descartados do produto)
lowStock = productBalance < minimum_stock_threshold
lowStockProductsCount = COUNT(DISTINCT product.id WHERE lowStock)
```

Movimentos de lotes arquivados não compõem o estoque operacional, embora permaneçam no histórico imutável.

**Retiradas**

```text
totalWithdrawalsCount = COUNT(stock_movements)
WHERE laboratory_id = L
  AND movement_type = 'WITHDRAWAL'
  AND S <= performed_at < E
```

**Consumo por projeto e produto**

```text
withdrawalCount = número de movimentos WITHDRAWAL do projeto no período
totalQuantity = SUM(WITHDRAWAL.quantity)
GROUP BY project_id, product_id, unit_of_measure
```

Grandezas físicas diferentes nunca são somadas. O grupo “Sem projeto associado” permanece apenas para dados legados, pois novas retiradas e reservas exigem projeto.

### 3.5 Limites e paginação de projetos

Analytics agregado e uso por projeto serão contratos separados:

- `GET /api/management/analytics`: retorna apenas KPIs escalares, período, timezone e `generatedAt`;
- `GET /api/management/project-usage`: retorna página de projetos e produtos consumidos.

Contrato de `project-usage`:

- `limit`: padrão 20, mínimo 1, máximo 50;
- máximo de 50 produtos consumidos por projeto na resposta;
- produtos adicionais exigem endpoint paginado de detalhe do projeto, não truncamento silencioso;
- ordenação estável: `reservedHours DESC`, `withdrawalCount DESC`, `projectId ASC`;
- cursor opaco contém os valores da ordenação e versão do cursor;
- a API retorna `hasNextPage` e `nextCursor`;
- tamanho serializado máximo da resposta: 512 KiB; ultrapassar o limite resulta em resposta controlada, sem retorno parcial silencioso.

O número de consultas SQL por página deve ser constante, independentemente do número de projetos. Meta: no máximo quatro consultas para KPIs + página de projetos, sem laço com chamadas ao banco.

### 3.6 Cursor opaco de auditoria

Ordenação canônica:

```text
occurred_at DESC, id DESC
```

Payload lógico do cursor:

```json
{
  "v": 1,
  "occurredAt": "2026-08-14T12:00:00.000Z",
  "id": "uuid",
  "filterHash": "sha256-base64url"
}
```

O valor HTTP é Base64URL de JSON validado por Zod. O cliente não constrói nem interpreta o cursor. Cursor inválido, versão desconhecida ou incompatível com o escopo retorna `400 VALIDATION_ERROR`.

Próxima página:

```text
(occurred_at, id) < (cursor.occurredAt, cursor.id)
```

Limite padrão 25, máximo 100. O cursor é válido apenas para os mesmos `laboratoryId`, período e filtros. A decisão congelada é usar `filterHash = Base64URL(SHA-256(filtrosCanônicos))`, calculado sobre laboratório, período, ator, ação, entidade e escopo. A API recalcula e compara o hash antes da consulta. O cursor não é barreira de autorização e não introduz novo segredo: toda autorização e todo filtro continuam sendo reaplicados no servidor.

### 3.7 Ator de sistema

`actorId` é `uuid | null`. Quando nulo:

- `actorName = "Sistema"`;
- a API não fabrica UUID;
- filtros por ator não incluem eventos de sistema, salvo filtro explícito futuro;
- Web e testes tratam o ator como sistema sem tentar abrir perfil.

---

## 4. RBAC e isolamento

### 4.1 Matriz congelada

| Papel | Analytics do laboratório | Auditoria geral do laboratório | Auditoria de controlados | Eventos globais |
|---|:---:|:---:|:---:|:---:|
| `USUARIO` | não | não | não | não |
| `TECNICO` | sim, somente membership ativa | sim, somente membership ativa | sim dentro do laboratório | não |
| `RESPONSAVEL_CONTROLADOS` | não | não | futuramente, somente eventos de controlados | não |
| `ADMIN` | sim, todos os laboratórios | sim, todos os laboratórios | sim | sim |

### 4.2 Decisão de menor privilégio para controlados

`RESPONSAVEL_CONTROLADOS` perde a permissão genérica `audit.read`. Nesta entrega ele não recebe acesso a auditoria geral.

Quando o módulo `controlled` for implementado, deverá ser criada a permissão `controlled.audit.read`, com consulta própria que comprove no servidor que o evento pertence a uma entidade controlada. Filtrar somente pelo texto de `action` ou `entity` não é suficiente para autorização.

Essa alteração toca permissões e exige revisão de caminho crítico. Testes devem demonstrar que o responsável por controlados não vê usuários, memberships, equipamentos ou movimentações comuns de estoque.

### 4.3 Escopo de eventos globais

Eventos com `laboratory_id IS NULL` não aparecem em consultas de laboratório. Somente `ADMIN` pode consultá-los por contrato de escopo explícito ou endpoint administrativo separado. A implementação não tornará `laboratoryId` simplesmente opcional em uma consulta comum, para evitar ampliação acidental de escopo.

### 4.4 Navegação

O item “Gestão” deve ser calculado para o laboratório ativo:

```text
showManagement = can(management.report.read, activeLaboratoryId)
              OR can(audit.read, activeLaboratoryId)
```

Não basta possuir a permissão em outro laboratório. Ocultar o item é conveniência; API e BFF continuam aplicando autorização no servidor.

---

## 5. Sanitização de auditoria

### 5.1 Política fail-closed

- entidade desconhecida: `before = null`, `after = null`, `redactedFields = ["*"]`;
- entidade conhecida: somente caminhos explicitamente permitidos por uma árvore de allowlist versionada;
- campos não permitidos são omitidos mesmo que não pareçam sensíveis;
- chaves sensíveis são normalizadas removendo `_`, `-`, espaços e diferenças de caixa antes da comparação;
- exemplos sempre proibidos: senha, hash, token, refresh token, segredo MFA, cookie, authorization, referência física de arquivo, conteúdo binário e material criptográfico;
- objetos aninhados usam allowlist de caminhos aninhados; não reutilizam a lista de campos do nível superior;
- arrays são limitados e seus itens são sanitizados;
- profundidade máxima: 5;
- máximo de 100 campos visitados;
- `before` e `after` sanitizados têm no máximo 64 KiB cada;
- estouro de limite resulta em omissão controlada e marcação em `redactedFields`, nunca em retorno bruto.

### 5.2 Separação de resumo e detalhe

A listagem nunca retorna `before` ou `after`. O detalhe exige nova checagem de autorização e escopo pelo `auditEventId`; um evento de outro laboratório deve resultar em `404`, evitando enumeração.

### 5.3 Resposta do BFF

O BFF valida query, parâmetros e resposta com os schemas compartilhados. Resposta upstream inválida retorna erro genérico `502 INVALID_UPSTREAM_RESPONSE`, `Cache-Control: no-store`, sem incluir payload bruto, stack ou detalhes internos.

---

## 6. Estratégia de consultas set-based

O adaptador PostgreSQL deve usar CTEs ou subconsultas agregadas, sempre filtradas por `laboratory_id` desde o primeiro conjunto de dados.

Estrutura recomendada:

1. `laboratory_context`: laboratório ativo e timezone;
2. `reservation_metrics`: horas sobrepostas e contagem no intervalo;
3. `batch_balances`: saldo derivado por lote;
4. `inventory_metrics`: lotes ativos, baixo estoque e validade;
5. `project_reservations`: agregação de reservas por projeto;
6. `project_withdrawals`: contagem por projeto;
7. `project_products`: consumo por projeto, produto e unidade;
8. união paginada dos agregados.

Regras:

- nenhuma interpolação de valores em SQL;
- todos os valores são parâmetros do driver;
- nenhuma consulta por item ou projeto dentro de laço;
- `reservations` se relaciona com `equipment_occupations` por `reservations.id = equipment_occupations.id`; é proibido usar colunas inexistentes em `reservations` ou inferir identidade por equipamento e horários;
- joins entre recurso e projeto incluem `laboratory_id` ou usam constraints que comprovem o mesmo escopo;
- `EXPLAIN (ANALYZE, BUFFERS)` deve ser registrado com massa representativa antes de aprovar índices;
- o repositório retorna apenas projeções do contrato, não linhas brutas.

---

## 7. Migrações e índices

### 7.1 Auditoria prévia obrigatória

Antes de editar `006_management_audit_indexes.cjs`, executar em `dev`, `homolog` e `prod`:

```sql
SELECT name, run_on
FROM arqueia_migrations
WHERE name = '006_management_audit_indexes';

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_events'
ORDER BY indexname;
```

Registrar o resultado no PR sem credenciais ou dados pessoais.

### 7.2 Regra de decisão

- se a `006` não foi aplicada em ambiente compartilhado: ela pode ser corrigida antes da aplicação, após confirmação documentada;
- se foi aplicada em qualquer `homolog` ou `prod`: é proibido editá-la; criar `007_management_query_indexes.cjs`;
- se o status não puder ser comprovado: assumir que foi aplicada e criar a `007`.

### 7.3 Índices candidatos

Validar com planos de execução, não criar por intuição:

- timeline por laboratório: `(laboratory_id, occurred_at DESC, id DESC)` com `laboratory_id IS NOT NULL`;
- filtro por ator dentro do laboratório: `(laboratory_id, actor_id, occurred_at DESC, id DESC)` com `actor_id IS NOT NULL`;
- eventos globais: `(occurred_at DESC, id DESC)` com `laboratory_id IS NULL`;
- movimentos por laboratório/período/projeto: índice candidato sobre `(laboratory_id, performed_at, project_id)` incluindo tipo conforme seletividade observada;
- ocupações por laboratório/período já devem ser confrontadas com os índices da migração de scheduling.

Depois de criar o índice substituto, avaliar a remoção do índice antigo `(laboratory_id, occurred_at)` somente se `EXPLAIN` e busca de consumidores demonstrarem redundância. A remoção ocorre em migração nova e reversível.

---

## 8. Checkpoints de implementação

### M0 — Preflight, plano e contrato

**Arquivos:** este plano, plano anterior, ADR/arquitetura se necessário.

**Ações:**

1. aprovar este documento;
2. marcar o plano anterior como supersedido;
3. resolver Git com `git rev-parse --show-toplevel`;
4. se `.git` não estiver acessível, parar: abrir o clone correto ou restaurar o workspace; não executar `git init` sobre uma cópia sem histórico;
5. registrar branch conforme `fix/management-corrections` ou `feat/management-hardening`;
6. confirmar a matriz RBAC e a retirada de `audit.read` de controlados;
7. auditar a aplicação da migração 006 nos três ambientes.

**Aceite:** plano aprovado, Git verificável, decisão da migração documentada e nenhum contrato aberto.

### M1 — Contratos compartilhados

**Arquivos:** `packages/contracts/src/management/*`, permissões de identidade e testes.

**Ações:**

1. separar analytics escalar de project usage paginado;
2. renomear `confirmedReservationCount` para `reservationCount`;
3. incluir `timezone` e período normalizado na resposta;
4. criar cursor opaco versionado para auditoria e project usage;
5. manter `actorId` nullable;
6. impor limites de página e de listas aninhadas;
7. remover `audit.read` de `RESPONSAVEL_CONTROLADOS`;
8. definir códigos de erro estáveis.

**Testes:** limites, intervalo, offset obrigatório, cursor válido/inválido, versão desconhecida, ator nulo, listas acima do limite e matriz de permissões.

**Aceite:** contratos Zod congelados e consumíveis por API/Web sem redefinição local.

### M2 — Banco e migrações

**Arquivos:** migração 006 ou nova 007, testes de migração e documentação de ambiente.

**Ações:** aplicar a regra de decisão da seção 7, criar somente índices comprovados, avaliar redundância e testar `up`/`down` em PostgreSQL 16 vazio e migrado.

**Aceite:** migrações reproduzíveis, sem edição de histórico aplicado e planos de execução anexados ao PR.

### M3 — Consultas, fórmulas e isolamento

**Arquivos:** porta de management, casos de uso e `PostgresManagementRepository`.

**Ações:**

1. implementar agregações set-based;
2. usar timezone do laboratório na validade;
3. aplicar fórmulas da seção 3;
4. eliminar N+1;
5. implementar páginas estáveis;
6. filtrar todos os conjuntos por laboratório;
7. devolver `404` para detalhe fora do escopo.

**Aceite:** número constante de queries, nenhum vazamento entre laboratórios e indicadores conferidos manualmente contra SQL de referência.

### M4 — Segurança, API e BFF

**Arquivos:** controller, pipes, filtros, casos de uso, sanitizador e rotas BFF.

**Ações:**

1. usar `ZodValidationPipe` para query e parâmetros;
2. aplicar RBAC da seção 4;
3. implementar sanitização por caminhos e limites;
4. validar respostas upstream no BFF;
5. preservar JWT apenas no servidor;
6. retornar `Cache-Control: no-store`;
7. separar endpoint/escopo de eventos globais;
8. não registrar payload sensível em logs de erro.

**Aceite:** testes de permissão, isolamento, enumeração, sanitização e respostas inválidas do upstream.

### M5 — Interface `/gestao`

**Arquivos:** página, cliente, apresentação/navegação, estilos e testes Web.

**Ações:**

1. ler `?laboratory=` e aceitar somente laboratório visível;
2. cair no primeiro laboratório visível somente quando o parâmetro estiver ausente ou inválido;
3. preservar laboratório ativo ao navegar;
4. calcular atalhos pelo timezone retornado, não pelo navegador;
5. mostrar o timezone real e o intervalo exato;
6. esconder “Gestão” conforme permissão no laboratório ativo;
7. carregar analytics, project usage e auditoria independentemente;
8. permitir que usuário com apenas `audit.read` veja auditoria sem erro de analytics;
9. implementar paginação e retry por seção;
10. fornecer estados independentes de carregamento, vazio, erro, proibido e sucesso;
11. tornar tabelas responsivas e modais acessíveis por teclado.

**Aceite:** troca de laboratório funciona pela URL, falha parcial não derruba outras seções e a UI não exibe dados fora do contrato.

### M6 — Custos e exportações — tarefa posterior

Não implementar neste ciclo. Abrir novo plano de alta complexidade para decidir:

- custo por lote versus produto;
- moeda e política cambial;
- preço unitário e unidade de compra versus unidade base;
- rateio de ajustes, descartes e transferências;
- snapshot histórico de preço no movimento;
- arredondamento e precisão decimal;
- contrato de job no worker;
- armazenamento, expiração, autorização e auditoria de Excel/PDF;
- conferência do relatório contra o ledger.

**Gate:** nenhuma estimativa de custo aparece como dado real antes desse contrato ser aprovado.

---

## 9. Plano de testes

### 9.1 Contratos e casos de uso

- Vitest para todos os schemas e fórmulas puras;
- RBAC por papel e laboratório;
- usuário com papel distinto em dois laboratórios;
- responsável por controlados sem auditoria geral;
- administrador em escopo global;
- ator de sistema nulo;
- cursor adulterado ou incompatível com filtros e versão desconhecida.

### 9.2 Integração PostgreSQL 16

Criar `postgres-management-repository.test.ts` contra PostgreSQL efêmero, com migrações reais. A suíte deve usar banco ou schema isolado e limpar somente seu próprio namespace.

Fixtures mínimas:

- dois laboratórios e projetos com nomes semelhantes;
- usuários com memberships diferentes;
- equipamento e reservas cruzando as bordas do período;
- reservas canceladas e concluídas;
- produtos e lotes com entrada, retirada, descarte e ajuste positivo/negativo;
- lotes arquivados, vencidos e nas fronteiras de 0 e 30 dias;
- eventos de auditoria com mesmo `occurred_at` e IDs diferentes;
- evento com ator nulo;
- entidade conhecida, entidade desconhecida e payload aninhado sensível.

Casos obrigatórios:

1. nenhuma linha do laboratório B aparece ao consultar A;
2. horas são recortadas corretamente em `[S, E)`;
3. ajuste negativo reduz saldo;
4. lote arquivado não entra no saldo operacional;
5. validade usa o timezone do laboratório;
6. página seguinte não repete nem pula eventos com timestamp igual;
7. quantidade de queries não cresce com o número de projetos;
8. resposta não ultrapassa limites;
9. sanitizador nunca retorna campo desconhecido ou segredo aninhado;
10. detalhe fora do laboratório retorna `404`.

No CI, usar serviço PostgreSQL 16 ou mecanismo efêmero equivalente. Mock de pool não substitui estes testes.

### 9.3 Web e BFF

- parâmetro `?laboratory=` válido, ausente, inválido e não autorizado;
- timezone diferente do navegador;
- permissão somente de analytics;
- permissão somente de auditoria;
- falha independente de cada endpoint;
- resposta upstream inválida;
- paginação, retry e ausência de duplicatas;
- navegação oculta no laboratório sem permissão;
- estados vazios e acessibilidade por teclado.

### 9.4 Verificação completa

Em cada checkpoint aplicável:

```text
npm run test --workspace @arqueia/contracts
npm run test --workspace @arqueia/database
npm run test --workspace @arqueia/api
npm run test --workspace @arqueia/web
npm run typecheck
npm run lint
npm run build
```

Depois:

- subir Docker local;
- aplicar migrações em banco limpo e banco atualizado;
- smoke test autenticado da API;
- conferir `/gestao` em mobile e desktop;
- testar dois laboratórios e os quatro papéis relevantes;
- registrar exatamente o que foi validado e limitações restantes.

Testes verdes não autorizam alegar cobertura total sem relatório de cobertura.

---

## 10. Definição de pronto

O ciclo estará pronto somente quando:

1. contratos deste plano estiverem implementados sem redefinição local;
2. todos os indicadores coincidirem com SQL de referência;
3. timezone do laboratório for usado em presets e validade;
4. não houver consulta N+1 nem resposta ilimitada;
5. cursor for estável, opaco e testado;
6. analytics e auditoria funcionarem e falharem independentemente;
7. controlados não tiverem acesso à auditoria geral;
8. sanitização for fail-closed, recursiva por caminhos e limitada;
9. integração PostgreSQL provar isolamento entre dois laboratórios;
10. migrações estiverem consistentes entre `dev`, `homolog` e `prod`;
11. `/gestao` respeitar URL, laboratório ativo e permissão específica;
12. typecheck, lint, testes, build e smoke test estiverem verdes;
13. custos e exportações continuarem claramente marcados como não implementados.

---

## 11. Parecer de início

**Podemos iniciar após ajustes/aprovação.**

Antes de M1, são obrigatórios:

1. aprovação explícita deste plano;
2. confirmação da retirada de `audit.read` de `RESPONSAVEL_CONTROLADOS`;
3. auditoria da migração 006 nos ambientes;
4. workspace Git válido e verificável.
