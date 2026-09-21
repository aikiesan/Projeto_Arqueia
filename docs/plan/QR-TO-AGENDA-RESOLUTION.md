# Plano — Resolução do QR do equipamento e solidez da agenda

## Problema

A etiqueta física grava `https://cp2b.unicamp.br/arqueia/qr?code=ARQ-EQP-<uuid>`
(`equipment-qr-label.ts`) — **sem o laboratório**. A partir daí, três defeitos
encadeados impedem que o scan chegue à agenda do equipamento:

1. **A página `/qr` adivinha o laboratório.** `qr-page-client.tsx` escolhe o lab
   de `?laboratory=`, senão o de código `CP2b`, senão o primeiro da lista. Se o
   equipamento pertencer a outro laboratório, a resolução falha sempre.
2. **Não existe resolução por identificador no servidor.** `listEquipmentQuerySchema`
   **exige** `laboratoryId` e não há `GET /equipment/:id`. Por isso o cliente
   varre páginas de 50 até 5 vezes (`qr-resolver.ts:findEquipmentById`)
   procurando o UUID: O(n), teto de 250 itens, e só dentro do lab adivinhado.
3. **A agenda carrega só 50 equipamentos** (`agenda-page-client.tsx`, `limit: '50'`).
   Se o equipamento escaneado não estiver entre os 50 primeiros, a agenda abre com
   `selectedEquipmentId` apontando para algo que não está na lista: aba sem
   destaque, `<select>` em branco e visão de dia sem o nome do equipamento.

Nenhum dos três é um detalhe de UI: o scan não funciona porque a resolução do
código não existe no servidor.

## Decisões de produto

- **Destino do scan é inteligente.** Com reserva ativa ou prestes a começar
  naquele equipamento, o scan abre o check-in. Sem reserva, vai direto para a
  agenda do equipamento, pronta para reservar. Nos dois casos, sem toque extra.
- **CLI de operação na VM:** diagnóstico de QR, geração de etiquetas em lote e
  auditoria de consistência da agenda.

## Arquitetura (SOLID, §3 do AGENTS.md)

### `packages/contracts` — fronteira compartilhada

`src/qr/qr-code.ts` passa a ser a **única** definição de como um código de QR é
lido. Hoje `parseQrCode` mora em `apps/web`, o que impede a API e a CLI de
concordarem com o cliente sobre o que uma etiqueta significa.

- `parseQrCode(raw): ParsedQrCode` — função pura, sem I/O.
- `resolveEquipmentByQrQuerySchema` — `{ code: string }`.

O código é transportado em **query string**, não em segmento de caminho: a
etiqueta grava uma URL completa, e embutir uma URL num segmento de caminho é
frágil na cadeia Apache → Next → Nest. É a diferença deliberada em relação a
`/inventory/batches/by-qr/:code`, que carrega só um código curto.

### `apps/api` — módulo `equipment`

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| domain | `ports/equipment-repository.port.ts` | `findActiveByQrIdentifier(identifier)` |
| application | `resolve-equipment-by-qr.use-case.ts` | uma intenção: etiqueta → equipamento autorizado |
| infrastructure | `postgres-equipment-repository.ts` | consulta por id **ou** código, sem cast inválido |
| interface | `equipment.controller.ts` | `GET /api/equipment/by-qr?code=…` |

O caso de uso resolve o equipamento **primeiro** e só então chama
`permissions.assertCan(principal, 'equipment.read', equipment.laboratoryId)` —
autorização papel × laboratório avaliada no servidor (§4.5), sem o cliente
informar qual laboratório quer.

### `apps/web`

- `qr-resolver.ts` troca a varredura paginada por uma chamada ao endpoint. O
  laboratório passa a vir do servidor, não de palpite.
- `qr-page-client.tsx` navega sozinho quando o código veio da URL (`?code=`), que
  é a intenção explícita de quem escaneou a etiqueta.
- `agenda-page-client.tsx` carrega **todos** os equipamentos do laboratório e
  segue o laboratório do equipamento do deep link.

### `packages/database` — CLI

| Script | Uso |
|---|---|
| `npm run qr:resolve -- <código>` | resolve uma etiqueta contra o banco e imprime lab, equipamento e URL de destino |
| `npm run qr:labels -- --laboratory=<id\|código>` | exporta equipamentos com o payload do QR (CSV ou HTML para impressão) |
| `npm run agenda:check` | audita ocupações órfãs, equipamentos arquivados com reserva viva e divergências entre `equipment_occupations` e `reservations` |

Cada script é uma casca fina sobre funções puras exportadas e testáveis, no
mesmo formato de `bootstrap-admin.ts`.

## Contrato de entrada e saída

- `GET /api/equipment/by-qr?code=<raw>` → `Equipment` (200) | 404 | 403.
- Nenhuma migração. Nenhuma alteração de permissão, auditoria ou estoque.

## Critérios de aceite

1. Escanear a etiqueta de um equipamento de **qualquer** laboratório autorizado
   resolve o equipamento, sem depender de palpite de laboratório.
2. Um equipamento na posição 300 da lista resolve igual ao primeiro.
3. Sem reserva ativa, o scan abre a agenda já filtrada naquele equipamento.
4. Com reserva ativa ou iminente, o scan abre o check-in.
5. A agenda com deep link mostra o equipamento selecionado na aba, no `<select>`
   e no cabeçalho da visão de dia — mesmo além dos 50 primeiros.
6. Usuário sem `equipment.read` no laboratório do equipamento recebe 403.
7. Lint, typecheck e suíte verdes.

## Testes

- `packages/contracts` — `parseQrCode` em todas as formas de etiqueta.
- `apps/api` — caso de uso: não encontrado, negado por laboratório, resolução por
  UUID e por código; repositório: consulta sem cast de uuid inválido.
- `apps/web` — resolvedor usa o endpoint e não pagina; agenda carrega todas as
  páginas; página de QR navega sozinha só quando deve.
- `packages/database` — funções puras de cada CLI.
