# ADR-007 — Catálogo de referências separado das entidades operacionais

- **Status:** aceito
- **Data:** 2026-08-14
- **Escopo:** catálogo, planejamento, equipamentos, estoque e espaços

## Contexto

O levantamento do CP2b reúne reagentes, materiais, tipos e modelos de equipamentos, demanda elétrica/térmica, ambientes, bancadas e mobiliário. Esses dados são úteis como opções de cadastro e planejamento, mas ainda não comprovam que cada item exista fisicamente, tenha sido comprado ou esteja disponível para uso.

Importar o levantamento diretamente como `Product`, `Lot` ou `Equipment` criaria ativos fictícios, misturaria alternativas de compra com patrimônio existente e enfraqueceria a rastreabilidade da origem.

## Decisão

Adotar três níveis separados:

1. **Fonte de catálogo (`CatalogSource`)** — versão identificada pelo hash SHA-256 do documento de origem e escopada ao laboratório.
2. **Linhas de origem (`CatalogSourceRow`)** — cópia completa e append-only das linhas não vazias, preservando aba, número da linha e valores para auditoria da importação.
3. **Opções normalizadas (`CatalogOption`)** — alternativas selecionáveis e tipadas, vinculadas à linha de origem. Tipos iniciais: reagente, material, tipo/modelo de equipamento, espaço, bancada, mobiliário e premissa de planejamento.

Uma opção **não é** uma entidade operacional. A confirmação humana é obrigatória para criar futuramente:

- `CatalogOption(REAGENT)` → `Product` → `Lot`;
- `CatalogOption(EQUIPMENT_MODEL)` → `Equipment`;
- `CatalogOption(SPACE/BENCH)` → localização operacional.

As futuras entidades operacionais poderão manter `catalog_option_id` opcional para rastrear sua origem sem depender do catálogo para existir.

## Segurança e privacidade

- Toda consulta é autenticada e exige permissão no laboratório solicitado.
- O repositório sempre filtra por `laboratory_id`; o cliente não determina sozinho o escopo autorizado.
- Consultas usam parâmetros do driver PostgreSQL. Filtros, limites, cursores e tipos passam por schemas Zod com listas permitidas e limites explícitos.
- A API não expõe `CatalogSourceRow.values`, nome físico do arquivo nem caminhos locais. Retorna somente a projeção normalizada de `CatalogOption`.
- Linhas de origem são append-only. Nova versão do documento cria uma nova fonte; não reescreve o histórico.
- Opções são arquivadas, nunca apagadas fisicamente pela aplicação.

## Consequências

- (+) Todo o levantamento pode morar no banco sem criar equipamentos ou estoque fictícios.
- (+) Importações são reproduzíveis, auditáveis e comparáveis por versão.
- (+) O catálogo aceita evolução gradual do modelo sem perder os valores originais.
- (+) Reduz o risco de vazamento acidental de dados brutos pela API.
- (-) Há uma etapa explícita de confirmação para converter opção em entidade operacional.
- (-) Metadados especializados continuam versionados no contrato e exigem validação ao evoluir.
