# ADR-004 — Estoque como livro-razão imutável (saldo derivado)

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto
Estoque de laboratório — em especial de controlados — exige rastreabilidade e conferência. Um campo "quantidade atual" editável perde histórico e é impossível de auditar.

## Decisão
O saldo de um lote é **derivado da soma de um livro de movimentações append-only** (`StockMovement`), nunca de um campo editável. Cada movimento grava `balance_before`/`balance_after`, ator, projeto, finalidade e origem. Correções são **novos movimentos** (`AJUSTE`/`DESCARTE`) com justificativa. Uma projeção de saldo pode existir apenas como **cache recalculável**.

## Consequências
- (+) Auditoria e conferência nativas; base direta para o livro de controlados (FR-CTL-4) e relatórios de consumo/custo.
- (+) Rastreabilidade de soluções preparadas (lotes de origem viram movimentos).
- (−) Leitura de saldo exige agregação (mitigável com cache/materialized view).
- **Proibido:** `UPDATE lot SET quantidade = X` ou `DELETE`/`UPDATE` de movimentos passados.

## Alternativas consideradas
- **Campo de saldo editável:** rejeitado — não auditável, viola princípio não negociável.
