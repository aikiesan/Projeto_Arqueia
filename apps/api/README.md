# @arqueia/api

API modular (NestJS). Cada bounded context é um módulo com **quatro camadas SOLID**; a dependência aponta para dentro (ver `AGENTS.md` §3).

```
src/modules/<contexto>/
├─ domain/          # entidades, value objects, regras puras, PORTAS (interfaces)
├─ application/     # casos de uso (uma intenção por caso de uso)
├─ infrastructure/  # adaptadores: repositórios Postgres, filas Redis, e-mail, storage
└─ interface/       # controllers HTTP + DTOs (casca fina)
```

Contextos: `identity`, `inventory`, `controlled`, `equipment`, `scheduling`, `multiuser`, `management`.

Regras invioláveis vivem no domínio e são cobertas por testes unitários (saldo do ledger, custódia de controlados, concorrência de reservas, autorização papel×lab). A infraestrutura implementa as portas; o domínio não importa Nest, Postgres nem Redis.

Expõe `/health` para os health checks de deploy. Porta padrão: 4001.

> Fase atual: esqueleto. O scaffold Nest é tarefa [O] da Fase 1.
