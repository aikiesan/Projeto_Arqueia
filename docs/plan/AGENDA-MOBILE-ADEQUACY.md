# Plano — Adequação móvel da agenda (Android e iOS)

## Objetivo

Corrigir o vazamento horizontal da página `/agenda` em celular — relatado em
`https://cp2b.unicamp.br/arqueia/agenda?laboratory=<uuid>` — e fechar as demais
lacunas que impediam a interface de ser usável em Android e iOS: campos de
formulário deformados, alvos de toque inconsistentes e ausência de áreas
seguras. No mesmo passo, tornar visível na própria grade o nome de quem reservou
cada equipamento.

## Diagnóstico

Medição em Chromium (390 px de largura, folha de estilo real, `overflow-x`
neutralizado para não mascarar o defeito):

| Sintoma | Antes | Depois |
| --- | --- | --- |
| Largura de rolagem do documento | 666 px sobre viewport de 320–414 px | igual à viewport |
| Caixa "Repetir esta reserva" (`input[type=checkbox]`) | 138 × 48 px, `appearance: none` | 22 × 22 px, marcador nativo |

Causas:

1. **Barra de controle com estilos embutidos de desktop.** O `<select>` de
   equipamentos não tinha `min-width: 0` nem `max-width`, então adotava a largura
   intrínseca da opção mais longa (nome + código do equipamento) e empurrava a
   linha inteira para fora da viewport. Era a origem única dos 666 px.
2. **Caixas de seleção herdando regra de campo de texto.** `.equipment-form input`
   aplicava `width: 100%`, `min-height: 48px` e `-webkit-appearance: none` a
   *todo* `input`, inclusive `checkbox` — daí o retângulo grande e vazio (no iOS,
   sem marcador algum, porque a aparência nativa havia sido removida).
3. **Modifiers sem regra CSS.** `equipment-primary-btn`, `schedule-card--in-progress`,
   `schedule-drawer-btn--primary`, `schedule-drawer-btn--complete`,
   `schedule-status-tag--in-progress`, `schedule-feedback--empty/--unavailable/--error`,
   `schedule-day-slot-empty-text` e `schedule-equipment-name` eram usados pelos
   componentes sem estilo correspondente.
4. **Raias do dia com largura fixa em JavaScript** (`minmax(220px, 1fr)`),
   impossível de ajustar por media query.
5. **Ausência de áreas seguras** (`env(safe-area-inset-*)`) no topo e nas laterais
   do shell, com `viewport-fit=cover` já ativo.
6. **Grades com track fixo maior que a coluna útil** em telas de 320 px
   (`minmax(290px, 1fr)` em `.equipment-grid`).

## Escopo

- Barra de controle da agenda: mobile-first, empilhada até 720 px, campos com
  `min-width: 0`/`max-width: 100%` e fonte de 16 px (limiar de zoom do Safari iOS).
- Caixas de seleção e botões de rádio com aparência nativa e 22 px.
- Modais como folha inferior no celular, com `env(safe-area-inset-bottom)` e ações
  empilhadas em largura cheia; layout de diálogo centrado volta a partir de 640 px.
- Raias do dia dirigidas por `--schedule-lane-gutter` / `--schedule-lane-width`.
- Áreas seguras no `WorkspaceShell` (topo, laterais e rodapé).
- `interactiveWidget: 'resizes-content'` no viewport, para o teclado virtual
  encolher o layout em vez de cobrir os campos.
- Alvos de toque de no mínimo 44 px e `touch-action: manipulation` nos controles.
- Nome de quem reservou exposto em `ScheduleItem.reservedBy`, exibido no cartão da
  grade e em "Reservado por" na gaveta de detalhes.
- Remoção dos estilos embutidos de `agenda-page-client.tsx` (zero ocorrências).

Fora de escopo: redesenho de fluxo, mudança de permissões, migrações.

## Contrato de entrada e saída

- `scheduleItemSchema` ganha `reservedBy: string | null` (opcional na entrada, para
  não invalidar respostas já existentes). Nulo em bloqueio técnico.
- `listSchedule` passa a fazer `LEFT JOIN users ru ON ru.id = r.user_id` e projeta
  `ru.name AS reserved_by`.
- Nenhuma alteração de migração, de autorização ou de auditoria.

## Nota de privacidade

`reservedBy` expõe o nome do reservante a quem já está autenticado e autorizado a
ver a agenda daquele laboratório. É uma exposição **mais restrita** que a já
vigente: `publicScheduleItemSchema` publica o mesmo nome na agenda aberta, sem
login, por decisão do responsável pelo laboratório. Continuam fora do item de
agenda, para quem não tem `canViewPrivateReservations`: e-mail, código de login,
projeto, finalidade, notas e contagem de amostras — `reservationDetails` segue
nulo nesse caso.

## Critérios de aceite

1. `document.scrollWidth === clientWidth` em 320, 360, 375, 390, 414 e 768 px, com
   `overflow-x` neutralizado, nas visões de semana e de dia.
2. A caixa de seleção do formulário de reserva mede 22 × 22 px e mantém o marcador
   nativo.
3. Toda classe usada pela agenda e por seus componentes tem regra CSS.
4. O nome de quem reservou aparece no cartão da grade e na gaveta; bloqueio técnico
   não inventa reservante.
5. Lint, typecheck e suíte de testes verdes.

## Testes

- `apps/web/app/agenda/agenda-mobile-layout.test.ts` — regressões de folha de
  estilo: exceção de checkbox/radio, contenção do `<select>`, empilhamento da barra
  de controle, ausência de estilo embutido, raias por variável CSS, áreas seguras e
  auditoria de classes sem regra.
- `apps/web/app/components/scheduling/schedule-requester.test.tsx` — nome do
  reservante no cartão, na descrição acessível e na gaveta.
- `apps/api/.../postgres-scheduling-repository.reserved-by.test.ts` — junção com
  `users`, propagação do nome mesmo sem `canViewPrivateReservations`, nulo em
  bloqueio técnico.
- `packages/contracts/src/scheduling/scheduling.test.ts` — contrato de `reservedBy`.
