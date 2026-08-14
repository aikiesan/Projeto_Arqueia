# Fase 1 — Catálogo de referência CP2b

## Objetivo

Importar integralmente o levantamento inicial do CP2b como referência versionada e opções de cadastro, sem afirmar existência física e sem criar `Product`, `Lot` ou `Equipment` operacionais.

## Contrato de entrada

- Fonte: `COMPLEMENTOS_PARA_ORGANIZAR/Equipamentos e Reagentes - CP2B (1) (1).xlsx`.
- Todas as seis abas e todas as linhas não vazias são preservadas.
- A versão da fonte é identificada por SHA-256.
- A grafia canônica apresentada pelo sistema é `CP2b`; o nome físico do arquivo de origem permanece inalterado.

## Contrato de saída

- `CatalogSource`: fonte versionada e escopada ao laboratório.
- `CatalogSourceRow`: linha original append-only com aba, número, valores e hash.
- `CatalogOption`: projeção normalizada e tipada para reagentes, materiais, tipos/modelos de equipamento, espaços, bancadas, mobiliário e premissas de planejamento.
- `GET /api/catalog/options`: consulta autenticada por laboratório e tipo, com busca limitada e paginação por cursor.

## Segurança

- Todo SQL recebe valores por parâmetros do driver PostgreSQL.
- Laboratório e tipo são filtros obrigatórios no repositório.
- O servidor exige a permissão correspondente a estoque, equipamentos ou leitura do laboratório.
- A API não retorna valores brutos, caminho/nome físico da planilha ou credenciais presentes em URLs.
- URLs de referência aceitam somente HTTP(S) e perdem usuário, senha, query string e fragmento.
- Linhas de origem não podem ser atualizadas nem apagadas.

## Critérios de aceite

- [x] Contrato compartilhado congelado e validado com Zod.
- [x] ADR de separação entre referência e entidade operacional aceito.
- [x] Migração idempotente e auditável.
- [x] Todas as linhas não vazias das seis abas preservadas.
- [x] Nenhum produto, lote ou equipamento operacional criado.
- [x] Seed DEV/HOMOLOG idempotente e proibido em produção.
- [x] API autenticada, com RBAC papel × laboratório e resposta sem dados brutos.
- [x] Teste de regressão para entrada semelhante a SQL injection.
- [x] Docker local validado com PostgreSQL 16, Redis 7, API, web e worker saudáveis.

## Resultado local verificado em 2026-08-14

- 363 linhas de origem.
- 349 opções normalizadas: 20 reagentes, 44 materiais, 31 tipos de equipamento, 42 modelos, 50 espaços, 21 bancadas, 56 itens de mobiliário e 85 premissas de planejamento não selecionáveis.
- Extensão `btree_gist` habilitada.
- Consulta sem token retorna HTTP 401; tentativa de injeção permanece em parâmetro e não altera a tabela.

Ver também [ADR-007](../decisions/ADR-007-reference-catalog.md) e [modelo de dados](../architecture/DATA-MODEL.md).
