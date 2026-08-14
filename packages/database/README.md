# @arqueia/database

Schema, migrações, seeds e implementações de repositório (adaptadores de persistência que implementam as **portas** definidas no domínio de cada módulo).

Invariantes que as migrações devem garantir (ver `docs/architecture/DATA-MODEL.md` §8):
- `StockMovement` e `AuditEvent` append-only (sem UPDATE/DELETE) — saldo é derivado.
- `RETIRADA` de lote controlado exige `CustodyEvent` na mesma transação.
- `Reservation` com `EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&)` (requer extensão `btree_gist`).
- Soft-delete (`archived_at`) em dados operacionais.

## Migrações

Usamos `node-pg-migrate`: ele mantém o SQL PostgreSQL explícito e suporta extensões,
triggers e constraints específicas sem esconder as invariantes do domínio.

```bash
npm run db:migrate
npm run migrate:down --workspace @arqueia/database # somente em dev
```

`DATABASE_URL` é obrigatório. Migrações aplicadas em homologação ou produção nunca são
editadas; uma correção sempre cria uma nova migração.
