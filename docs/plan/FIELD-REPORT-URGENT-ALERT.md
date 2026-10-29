# Alerta de informe urgente

## Escopo

Hoje um informe só aparece na triagem: quem precisa agir descobre quando abre a
página. Para um acidente, isso é tarde. Este trabalho avisa por e-mail a
coordenação quando o informe indica emergência.

Fora de escopo: notificação por SMS ou push, escalonamento quando ninguém
responde, e fila no worker (ele ainda é uma casca sem consumidores).

## Contratos

Nenhum contrato novo. O alerta é efeito do envio já existente
(`POST /api/public/field-reports`): a resposta para quem enviou continua sendo
só o protocolo e o horário. Quem relata **não** sabe se um alerta saiu — e nem
deve saber, para o formulário não virar uma forma de descobrir quem está de
plantão.

## Decisões

1. **Dois sinais, em ordem de confiança.** `blocksUse` — campo estruturado do
   formulário — vem antes das palavras-chave. Texto é frágil: quem está diante
   de um acidente escreve com pressa. O pedido desta função chegou escrito
   "SOCORRRO", com três erres, e isso virou caso de teste.
2. **A comparação normaliza antes**: minúsculas, sem acento, e letras repetidas
   reduzidas a uma só. É o que faz "SOCORRRO" e "URGENTEEE" baterem. A busca é
   por palavra inteira, senão "fogo" acenderia dentro de "afogamento".
3. **O tipo do informe não dispara alerta.** `EQUIPMENT_PROBLEM` é a maioria dos
   envios; alertar por tipo faria o e-mail virar rotina, e alerta que chega
   sempre é alerta que ninguém lê.
4. **Destinatário é quem tem `field-report.review` no laboratório** — a mesma
   regra que já decide quem lê os informes. Os papéis são derivados do mapa de
   permissões em tempo de execução, não escritos à mão: dar ou tirar a permissão
   de um papel muda a lista de avisados sem editar código, e sem ninguém
   esquecer um endereço desatualizado no `.env`.
5. **O alerta nunca derruba o envio.** Ele acontece depois da gravação, e toda a
   etapa — incluindo a própria auditoria do alerta — está sob `try`. Um relay de
   e-mail fora do ar não pode fazer quem relatou um acidente ver erro e achar
   que nada foi registrado.
6. **A auditoria grava o desfecho**, inclusive `recipientCount: 0`: um
   laboratório sem revisor cadastrado é justamente o caso que precisa aparecer
   na trilha, e não sumir em silêncio.
7. **O e-mail escapa a mensagem.** Ela vem da internet aberta, sem login.

## Arquitetura SOLID

- `assessFieldReportUrgency` é função pura do domínio: a regra de negócio não
  sabe que existe e-mail.
- Portas novas: `FieldReportAlertRecipientReader` (quem avisar) e
  `UrgentFieldReportNotifier` (como avisar), pequenas e separadas por intenção.
- O transporte de e-mail virou `MailSender`, em `shared/infrastructure`. É o
  único lugar que conhece nodemailer; identidade e informes montam suas próprias
  mensagens e entregam ali. O notificador de redefinição de senha foi
  refatorado para usar o mesmo transporte, em vez de abrir o seu.
- `AUDIT_EVENT_WRITER` passou a ser exportado pelo módulo de identidade: gravar
  auditoria é capacidade compartilhada, não privilégio de um módulo.

## Ambiente

Reaproveita `SMTP_*`, `PUBLIC_ORIGIN` e `NEXT_PUBLIC_BASE_PATH`. **Sem
`SMTP_HOST`, o alerta vai para o log da API e ninguém é avisado** — o mesmo
comportamento da redefinição de senha, e o mesmo risco: a auditoria registra
`channel: "log"` para deixar isso visível.

## Limite conhecido

Quem envia é anônimo, e o formulário é público. O limitador por origem
(`FieldReportRateLimitGuard`) é o que contém envio em massa; não há limite
separado por alerta. Se o abuso aparecer, o passo seguinte é agrupar alertas do
mesmo laboratório em janela curta, não endurecer o formulário.

## Critérios de aceite

- Informe de rotina não dispara e-mail nem evento de auditoria.
- "SOCORRRO" e equipamento marcado como parado disparam.
- Falha de e-mail não impede a gravação do informe.
- Lint, typecheck e as suítes de API, web, contracts e database passam.
