# Plano canônico — Home como HUB operacional

## 1. Objetivo e fronteira

A rota `/` é o ponto de entrada diário do laboratório. Ela responde: o que acontece hoje, o que requer atenção e qual ação autorizada pode ser iniciada agora. Ela não substitui `/gestao`, não apresenta séries históricas e nunca simula informação operacional.

O contrato compartilhado é `dashboardSummarySchema`, em `packages/contracts/src/management/dashboard.ts`. Web, API e worker não podem redefinir suas projeções localmente.

## 2. Contexto do laboratório

O laboratório ativo é resolvido nesta ordem: `?laboratory=<uuid>` autorizado, preferência persistida válida, primeiro membership ativo e, para administrador, primeiro laboratório institucional. Código ou nome como `CP2b` nunca é usado como seleção fixa. Sem laboratório autorizado, a Home apresenta um estado explícito sem contexto.

Toda leitura é escopada por `laboratory_id` no servidor. A autorização é papel × laboratório e ocorre antes da consulta. As listas e ações retornadas já chegam filtradas; nomes de papéis não são interpretados pela UI.

## 3. Tempo operacional

`timezone` vem de `laboratories.timezone` e deve ser um identificador IANA válido na aplicação. Para uma data civil `D` nesse timezone:

```text
startsAt = instante UTC correspondente a D 00:00:00 no timezone do laboratório
endsAt   = instante UTC correspondente a (D + 1 dia) 00:00:00 no mesmo timezone
Hoje     = [startsAt, endsAt)
```

Uma reserva participa do dia quando `reservation.starts_at < endsAt` e `reservation.ends_at > startsAt`. A fronteira nunca usa o timezone do navegador.

## 4. Indicadores e fontes canônicas

### Equipamentos

`equipmentSummary.total` é a quantidade de equipamentos operacionais não arquivados do laboratório. `byStatus` é uma partição pelo status canônico; a soma dos status deve ser igual ao total. Manutenção e avaliação são estados do cadastro, nunca inferências visuais.

### Reservas de hoje

`todayReservations` contém no máximo oito reservas autorizadas que intersectam Hoje. Ordenação: `startsAt ASC, id ASC`. Canceladas não são exibidas no resumo operacional, embora o contrato preserve os status canônicos para evolução compatível.

### Estoque

`LOW_STOCK` existe apenas quando `minimum_stock_threshold > 0` e o saldo derivado do livro-razão é menor ou igual ao limite. `EXPIRED` representa lote com validade anterior à data civil atual do laboratório. `EXPIRING` representa validade em `[hoje, hoje + 30 dias]`. Produto e lote permanecem entidades distintas e unidades físicas nunca são somadas entre produtos.

### Pendências

`upcomingActions` contém no máximo oito projeções reais e autorizadas, ordenadas por prioridade (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) e identificador determinístico. A UI não cria pendências a partir de texto, status ou contagens.

### Ações rápidas

`quickActions` contém no máximo seis links internos já autorizados pelo servidor. O cliente apenas renderiza `label` e `href`; ele não decide acesso por papel.

## 5. Disponibilidade e falhas parciais

Cada fonte possui uma flag em `availability`. `false` significa que a seção não pode ser apresentada naquele carregamento, seja por indisponibilidade ou por ausência de acesso; o payload não revela qual permissão faltou. Lista vazia com disponibilidade `true` significa sucesso sem ocorrências.

Falha de agenda não remove equipamentos ou estoque. Dados indisponíveis nunca são substituídos por zeros apresentados como reais. O backend agrega fontes com isolamento de falhas e valida a resposta completa pelo schema antes de enviá-la.

## 6. Limites, links e atualização

- Reservas, alertas e pendências: máximo de oito itens por lista.
- Ações rápidas: máximo de seis.
- Links são internos e começam por `/`.
- O endpoint não oferece paginação; cada seção aponta para sua tela completa.
- Após uma mutação, o cliente revalida a projeção e mostra somente valores confirmados pelo servidor.
- Cache compartilhado entre usuários ou laboratórios é proibido.

## 7. Endpoint e camadas

Endpoint planejado: `GET /api/management/dashboard?laboratoryId=<uuid>`.

- `interface`: valida UUID, autenticação e traduz HTTP.
- `application`: autoriza laboratório e coordena a leitura.
- `domain`: define porta pequena `getDashboardSummary`.
- `infrastructure`: executa consultas set-based, limitadas e escopadas.
- BFF Web: encaminha sessão, valida a resposta Zod e devolve `502` para upstream incompatível.

## 8. Critérios de aceite

1. Nenhum dado do laboratório B aparece no laboratório A.
2. “Hoje” respeita `laboratories.timezone` e intervalo semiaberto.
3. Saldo de estoque é exclusivamente derivado do ledger, incluindo ajustes.
4. Uma fonte indisponível não derruba as demais.
5. Listas e ações respeitam RBAC e limites contratuais.
6. Estados de carregamento, vazio e erro são distinguíveis e acessíveis.
7. Viewports de 390 px e 1440 px permanecem utilizáveis.
8. `prefers-reduced-motion` elimina movimento não essencial.
9. Testes de integração PostgreSQL usam dois laboratórios e casos de fronteira temporal.
10. Build, typecheck, lint e suíte completa permanecem verdes.

## 9. Sequência de entrega

- H0: este contrato e plano canônico.
- H1: caso de uso, RBAC, timezone e repositório PostgreSQL.
- H2: endpoint e BFF validado.
- H3: componentes e estados parciais.
- H4: integração PostgreSQL, acessibilidade e fluxo ponta a ponta.

Mudanças em contrato, autorização, ledger, SQL ou tempo operacional exigem revisão de alta complexidade antes do desenvolvimento mecânico.
