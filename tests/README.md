# tests/

Testes end-to-end e de integração que cruzam apps (Playwright). Testes unitários de domínio e de casos de uso ficam junto de cada módulo em `apps/api`.

Fluxos críticos a cobrir (ver `AGENTS.md` §5):
- Login e autorização papel×laboratório (acesso negado no servidor).
- QR → ficha do item → retirada (saldo derivado do ledger).
- Reserva com conflito (constraint de exclusão barra sobreposição).
- Retirada de reagente controlado (falha sem cadeia de custódia).
- Portal multiusuário (token não previsível, acompanhamento sem conta).

## Suítes de integração com banco real

Três suítes gravam no banco de `DATABASE_URL`, inclusive em `stock_movements` e
`audit_events`, que são append-only e recusam `DELETE`:

- `packages/database/src/scheduling-exclusion-and-ledger-invariants.challenge.test.ts`
- `apps/api/src/modules/inventory/infrastructure/postgres-inventory-repository.integration.test.ts`
- `apps/api/src/modules/scheduling/infrastructure/postgres-scheduling-repository.integration.test.ts`

Elas só rodam quando o nome do banco termina em `_test`, como o `arqueia_test` da
CI. Qualquer outro nome faz as três serem puladas, inclusive o `arqueia` do
desenvolvimento e o da produção. Antes de escrever, cada suíte confere também
`current_database()` no servidor. O guarda mora em
`packages/database/src/testing/integration-database.ts`, e o teste dele reprova
qualquer suíte nova que abra conexão sem passar por ele (ver
`docs/plan/INTEGRATION-TEST-DATABASE-GUARD.md`).

Para rodá-las no notebook, crie um banco `arqueia_test` ao lado do de
desenvolvimento, no mesmo Postgres do Docker. No Git Bash, com a pilha no ar
(`npm run dev:up`). A porta é a de `POSTGRES_PORT` no seu `.env`; o exemplo usa
5433:

```bash
docker compose -f docker-compose.dev.yml exec -T postgres createdb -U arqueia arqueia_test
ARQ_TEST_DB='postgresql://arqueia:arqueia_dev_only@localhost:5433/arqueia_test'
DATABASE_URL=$ARQ_TEST_DB npm run db:migrate
DATABASE_URL=$ARQ_TEST_DB DEV_SEED_ADMIN_PASSWORD=change-this-dev-password npm run db:seed
DATABASE_URL=$ARQ_TEST_DB npm test
```

A variável vai como prefixo de cada comando, nunca com `export`: exportada no shell
que roda o Docker Compose, ela venceria o `.env` e a API passaria a procurar o banco em
`localhost` dentro do container. O que as suítes gravam fica no `arqueia_test`;
para recomeçar do zero, apague-o com `dropdb` no lugar do `createdb` e repita o
bloco.
