# Desenvolvimento local com Docker

Este ambiente atende ao ADR-006: Docker e usado somente no desenvolvimento local.
A implantacao em homologacao e producao continua nativa na VM Debian, com Apache2,
PM2, PostgreSQL e Redis gerenciados pelo sistema, conforme ADR-001 e
`VM-DEPLOYMENT.md`.

## Pre-requisitos

- Docker Desktop com Docker Compose;
- Git;
- portas 4001, 4002, 5432 e 6379 disponiveis (ou alteradas no `.env`).

As imagens fixam a mesma linha principal da VM: Node 20, PostgreSQL 16 e Redis 7.

## Primeiro uso

Na raiz do repositorio, copie o arquivo de exemplo sem versionar o resultado:

```powershell
Copy-Item .env.example .env
```

Em Linux/macOS, use `cp .env.example .env`. Os valores padrao sao exclusivos para
desenvolvimento. Nunca reutilize `POSTGRES_PASSWORD` ou `JWT_SECRET` em homologacao
ou producao.

Valide e suba o ambiente:

```bash
npm run dev:config
npm run dev:up
npm run dev:logs
```

Servicos locais:

| Servico | Endereco | Health check |
|---|---|---|
| Web/PWA | `http://localhost:4002` | pagina inicial retorna HTTP 2xx |
| API | `http://localhost:4001` | `GET /health` retorna HTTP 2xx |
| PostgreSQL | `localhost:5432` | `pg_isready` |
| Redis | `localhost:6379` | `redis-cli ping` |
| Worker | sem porta publica | processo Node ativo |

Os containers de aplicacao montam o repositorio em `/workspace`; API, web e worker
executam seus scripts `dev` com hot reload. Em Docker Desktop para Windows, o web usa
polling para detectar mudancas no bind mount.

## Banco e migracoes

Na primeira criacao do volume do PostgreSQL, o script em
`infrastructure/docker/postgres/init/001-enable-btree-gist.sql` habilita
`btree_gist`, exigida pelo ADR-005. Confirme quando necessario:

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U arqueia -d arqueia -c "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"
```

Execute migracoes e seeds dentro do container da API, a partir da raiz do monorepo:

```bash
docker compose -f docker-compose.dev.yml exec api npm run db:migrate
docker compose -f docker-compose.dev.yml exec api npm run db:seed
```

Seeds sao permitidos apenas em desenvolvimento e homologacao.

## Ciclo diario

```bash
npm run dev:up       # constroi e sobe em segundo plano
npm run dev:logs     # acompanha logs de todos os servicos
npm run dev:down     # para e remove containers/rede, preservando dados
```

Para acompanhar um unico servico:

```bash
docker compose -f docker-compose.dev.yml logs -f api
```

`dev:down` preserva os volumes nomeados. Para reinicializar deliberadamente os dados
locais, use `docker compose -f docker-compose.dev.yml down --volumes`. Essa operacao
remove o banco e o Redis locais e nao deve ser usada se os dados precisarem ser
recuperados.

## Verificacao antes de entregar um bloco

O Docker nao muda os comandos de qualidade nem o artefato de producao. Rode:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
docker compose -f docker-compose.dev.yml config
```

O mesmo `npm run build` e usado no container de desenvolvimento e nativamente na VM.
Dockerfiles `*.dev` e `docker-compose.dev.yml` nao fazem parte do deploy de producao.

## Solucao de problemas

- **Porta ocupada:** altere `API_PORT`, `WEB_PORT`, `POSTGRES_PORT` ou `REDIS_PORT` no
  `.env`. Se mudar a porta publica da API, ajuste tambem `NEXT_PUBLIC_API_URL`.
- **Dependencias mudaram:** execute novamente `npm run dev:up`. O build usa `npm ci`
  com o lockfile do monorepo e renova somente os volumes anonimos de `node_modules`;
  os volumes nomeados do PostgreSQL e Redis permanecem preservados.
- **Extensao ausente em volume antigo:** aplique `CREATE EXTENSION IF NOT EXISTS
  btree_gist;` como usuario do banco ou recrie somente o volume local se seus dados
  puderem ser descartados.
- **Hot reload lento no Windows:** mantenha Docker Desktop e o repositorio em uma
  unidade compartilhada; `WATCHPACK_POLLING=true` ja esta configurado para o web.
