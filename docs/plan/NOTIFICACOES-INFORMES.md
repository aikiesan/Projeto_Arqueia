# Plano — Sino de notificações e botão "Informar"

> Continuação de [`INFORMES-E-IDENTIDADE-CP2B.md`](INFORMES-E-IDENTIDADE-CP2B.md). Os informes já
> chegavam pelo QR, mas a coordenação só os via se abrisse `/informes`, e quem estava logado não
> tinha um atalho óbvio para avisar algo.

## Problema

- O sino do topo era **decorativo**: um botão sem ação, com uma bolinha vermelha sempre acesa.
  Para quem olhava, havia sempre "algo novo", e nunca havia nada.
- Para enviar um informe de dentro do app, era preciso conhecer a URL ou achar um cartaz com QR.

## Decisões

- **Sino no app, sem push.** O sino mostra quantos informes estão **Novos** no laboratório ativo
  e lista os 5 mais recentes. Funciona igual no web e no celular (o topo é o mesmo). Atualiza a
  cada 60 s com a aba visível, quando a aba volta ao foco, ao abrir o painel e logo depois de uma
  triagem em `/informes`. Push com o app fechado (Web Push, chaves VAPID) ficou para depois:
  escolha do responsável.
- **"Novo" é a fila da coordenação, não um "lido" pessoal.** O contador é o status `NEW`: quando
  alguém tria um informe, o contador cai para todos. Não há tabela nova nem migração.
- **Quem recebe:** só quem tem `field-report.review` no laboratório ativo (coordenação e ADMIN).
  Para os demais, o sino fica **sem contador e sem chamadas à API**, e o painel aponta para o
  Informar. A permissão real continua na API: o sino usa as mesmas rotas de `/informes`.
- **Botão "Informar"** (megafone, lima com tinta petróleo, o par de destaque do site do CP2b)
  sempre visível no topo, para qualquer papel. Abre `/informar?laboratory=<ativo>`. Abaixo de
  360 px de largura, vira só o ícone (o nome segue no `aria-label`).

## Arquitetura

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| ui | `notification-center.tsx` | sino só de apresentação: contador (até 99+), painel, vazio, erro, "Ver todos"; fecha com Esc ou clique fora |
| ui | `workspace-shell.tsx` | dois espaços opcionais no topo, `notifications` e `reportAction`; sem eles, nada de sino falso |
| ui | `icons.tsx` | ícone `informar` (megafone) |
| web | `presentation.ts` | `reportAction` e `notificationScope` (laboratório ativo e se pode revisar) |
| web | `components/notifications/field-report-notifications.ts` | hook: resumo e 5 novos, validados pelos contratos; intervalo, foco, evento de triagem |
| web | `components/notifications/workspace-notifications.tsx` | liga o hook ao sino; textos para coordenação e para os demais |
| web | 11 páginas com `WorkspaceShell` | passam o sino e o Informar |

Nenhuma mudança em API, contrato, banco ou permissão.

## Critérios de aceite

1. A coordenação vê no sino o número de informes novos do laboratório ativo e os 5 mais recentes.
   Os que impedem o uso aparecem com marca vermelha.
2. "Ver todos os informes" leva a `/informes?laboratory=<ativo>`.
3. Depois de triar em `/informes`, o contador cai sem recarregar a página.
4. Quem não revisa informes vê o sino sem contador e não dispara nenhuma chamada.
5. O Informar aparece em todas as páginas do workspace, no web e no celular, e abre o formulário
   no laboratório ativo.
6. Sem rolagem horizontal no celular (393 px e 340 px).
7. Lint, typecheck, testes, build e e2e verdes.

## Testes

- `ui`: sino (contador, 99+, links prefixados, urgente, Esc e clique fora, vazio e erro) e shell
  (sem sino falso; Informar e sino no topo).
- `web`:
  - hook (sem chamadas para quem não revisa; contagem e lista; intervalo e evento de triagem; erro);
  - sino ligado;
  - `presentation` (Informar no laboratório ativo; só a coordenação recebe).
- `e2e` (desktop e celular): o sino mostra o informe recém-enviado, "Ver todos" abre o compilado
  e o Informar do topo abre o formulário.

## Atalhos sem login na entrada

Alunos e visitantes chegam pelo site do CP2b na tela de login. Ali, "Ver agenda" e "Informar"
eram links pequenos no fim do cartão, abaixo da dobra no celular. Agora:

- **Login:** dois cartões grandes, **antes** do formulário, sob o selo "Sem login · para alunos e
  visitantes": **Ver agenda** (verde-escuro) e **Informar** (lima, o mesmo do topo do app).
  Lado a lado no celular e no desktop; um sobre o outro abaixo de 340 px. O formulário vem logo
  depois ("Tem conta? Entre para reservar") e continua na primeira tela do celular.
- **Agenda pública:** botão **Informar** no cabeçalho, já com o laboratório exibido.
- **Formulário de informes:** o "Ver agenda" do cabeçalho ganha o ícone de calendário.

## Próximo passo possível

**Push com o app fechado** (Web Push). Exige:
- chaves VAPID no `.env` da VM;
- uma tabela de inscrições (migração);
- o envio pelo worker;
- no iPhone, o Arqueia instalado na tela inicial.

O sino atual já é o ponto de entrada para o botão "Ativar notificações".
