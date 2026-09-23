# Plano — Guarda do banco das suítes de integração

## Problema

Três suítes gravam no banco de `DATABASE_URL`. Medido por execução, num banco
recém-migrado e populado:

| Suíte | O que deixa para trás |
|---|---|
| `packages/database/src/scheduling-exclusion-and-ledger-invariants.challenge.test.ts` | 1 instituição, 1 laboratório, 1 usuário, 2 equipamentos, 1 lote, 6 ocupações, 4 `stock_movements`, 1 `audit_events` |
| `apps/api/src/modules/inventory/infrastructure/postgres-inventory-repository.integration.test.ts` | 1 instituição, 1 laboratório, 1 usuário, 1 lote, 2 `stock_movements`, 3 `audit_events` |
| `apps/api/src/modules/scheduling/infrastructure/postgres-scheduling-repository.integration.test.ts` | 3 `audit_events`; no caminho, apaga e recria o laboratório `SCHED-B`, um projeto e dois equipamentos de id fixo |

Até aqui o único critério era `describe.skipIf(databaseUrl === undefined)`: bastava
a variável existir. O `.env` da VM define `DATABASE_URL` apontando para produção,
e a seção de CLI do `VM-DEPLOYMENT.md` mandava carregá-lo com
`set -a; . ./.env; set +a` num shell interativo. Qualquer `npm test` rodado depois
nesse shell escreveria em produção.

`stock_movements` e `audit_events` são append-only: o gatilho
`reject_append_only_mutation` recusa `DELETE`. O que as suítes gravam não sai mais.

Reproduzido num Postgres 16 local, com um banco `arqueia_guarda` migrado e populado
no papel de produção: as três suítes passaram sem objeção e deixaram 6
`stock_movements`, 7 `audit_events` e 2 laboratórios. O `DELETE` das duas primeiras
falhou com `stock_movements is append-only; DELETE is forbidden`.

## Decisão

As suítes só escrevem num banco **descartável**, e descartável é o banco cujo nome
termina em `_test`, como o `arqueia_test` da CI. Nenhum nome de produção ou de
desenvolvimento (`arqueia`) passa.

O guarda tem duas travas, porque o nome lido da URL é uma interpretação nossa e
quem decide o banco é o servidor:

1. **Na coleta** (`resolveIntegrationDatabase`), função pura sobre o ambiente.
   Lê o nome do banco do caminho da URL, com o mesmo `decodeURI` que o
   `pg-connection-string` usa. Recusa, com o motivo, quando:
   - `DATABASE_URL` está ausente ou vazia;
   - não é uma URL `postgres:`/`postgresql:`;
   - não nomeia o banco (o `pg` cairia em `PGDATABASE` ou no nome do usuário,
     que não dá para provar descartável);
   - o nome não termina em `_test`. O sufixo é comparado **no nome**, não na
     string: `…/arqueia?application_name=x_test` é recusado.

   A suíte usa o resultado em `describe.skipIf(!integrationDatabase.enabled)`.
2. **Na conexão** (`connectIntegrationDatabase`), a suíte só recebe o pool depois de
   `SELECT current_database()` também terminar em `_test`. Se não terminar, o pool
   é fechado e a promessa rejeita.

A segunda trava existe por causa de um detalhe verificado no Vitest 3.2.7: **o
`afterAll` roda mesmo quando o `beforeAll` falha**. A suíte de agendamento limpa
seus dados no `afterAll` com `DELETE` sempre que o pool existe. Por isso o guarda
não pode criar o pool e depois conferir o banco: a limpeza rodaria no banco errado.
Como `connectIntegrationDatabase` só devolve um pool já conferido, a variável
continua `undefined` quando a conferência falha e nenhum hook tem onde escrever.

### Silêncio na CI

Uma suíte pulada não quebra nada, e é isso que torna o guarda perigoso ao
contrário: se alguém trocar o nome do banco da CI, as três suítes somem sem aviso.
O teste do guarda tem um caso que só roda com `CI=true` (o GitHub Actions define
essa variável) e falha se o ambiente da CI não habilitar a integração.

## Arquitetura

`packages/database` é o dono das conexões, então o guarda mora lá e é exportado
pelo índice, como `createDatabasePool`:

| Arquivo | Responsabilidade |
|---|---|
| `src/testing/integration-database.ts` | `resolveIntegrationDatabase` (coleta) e `connectIntegrationDatabase` (conexão) |
| `src/testing/integration-database.test.ts` | casos do guarda, sem banco (a fábrica do pool é injetável para simular `current_database()`), e a auditoria das suítes |

`connectIntegrationDatabase` recebe a fábrica do pool como parâmetro com padrão
`createDatabasePool` (inversão de dependência): o teste troca por um pool falso e
prova que o pool recusado é fechado.

As três suítes trocam `process.env.DATABASE_URL` + `createDatabasePool` pelo par
`resolveIntegrationDatabase` + `connectIntegrationDatabase`. Os `afterAll` passam a
tolerar pool ausente.

### Auditoria das suítes

O guarda só protege quem o usa: uma suíte nova que copie o padrão antigo o
contornaria. O teste do guarda percorre os `*.test.ts`/`*.spec.ts` de `apps/`,
`packages/` e `tests/` e reprova quem ler `process.env.DATABASE_URL`, chamar
`createDatabasePool(` ou instanciar `Pool`/`Client` do `pg`. Ele também exige que
as três suítes conhecidas chamem `connectIntegrationDatabase(`, para a varredura
não passar em branco se deixar de encontrar os arquivos.

## Documentação

- `docs/deployment/VM-DEPLOYMENT.md`: todas as receitas que faziam
  `set -a; . ./.env; set +a` no shell interativo passam a fazer isso num subshell
  `( … )`, que descarta as variáveis ao terminar. A seção de CLI ganha também a
  receita de disparo único a partir do notebook (`vm bash -ls <<'EOF'`).
- `tests/README.md`: como rodar as suítes de integração localmente, contra um
  `arqueia_test` separado do banco de desenvolvimento.

## Critérios de aceite

- Com `DATABASE_URL` apontando para um banco sem `_test`, as três suítes são
  puladas e nenhuma linha é gravada (conferido por contagem antes/depois).
- Com `arqueia_test`, as três suítes rodam e passam, como antes.
- O teste do guarda cobre: ausente, vazia, protocolo errado, URL inválida, sem
  nome, nome de produção, sufixo só na query, sufixo no meio, maiúsculas, nome
  codificado, `current_database()` divergente (pool fechado) e o caso da CI.
- Antes da correção, a auditoria reprova as três suítes; depois, não reprova nenhuma.
- CI verde, incluindo o e2e.

## Fora do escopo

O e2e `tests/e2e/scheduling.spec.ts` também escreve, só que pela API da pilha
apontada por `PLAYWRIGHT_TEST_BASE_URL`. Ele não abre conexão com o banco, então
este guarda não o alcança. Continua valendo a regra operacional: contra a VM, só
`tests/e2e/base-path.spec.ts`.
