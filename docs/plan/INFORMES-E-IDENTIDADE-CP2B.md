# Plano — Informes pelo QR e identidade visual do CP2b

> Sistema inicial de **informe, cuidado e apoio para registros e manutenção**: quem usa o
> laboratório escaneia um QR e avisa a coordenação, sem login. O que chega fica compilado
> numa página que só a coordenação vê. Junto, o Arqueia passa a usar a paleta do site do
> CP2b (cp2b.unicamp.br, repositório `aikiesan/cp2bfun`).

Duas entregas pequenas e independentes. A **A** (visual) não toca domínio. A **B** (informes)
toca permissões e auditoria e cria a **primeira escrita pública de conteúdo** do sistema (fora do login). Pelo §1.4 do
AGENTS.md, ela exige revisão Opus.

---

## A. Identidade visual do CP2b

### Problema

O Arqueia usava verde-floresta (`#123f34`), lima claro (`#d6f265`) e fundo cinza-esverdeado.
O site do CP2b usa azul-petróleo, verde-escuro, lima e fundo "papel". No cabeçalho do site,
o selo **"Arqueia" já é azul-petróleo** (`design-system.css`). O produto e o site pareciam
de famílias diferentes.

### Decisão: trocar tokens, não telas

Os tokens moram em `packages/ui/src/styles.css`. Trocar os valores muda o sistema inteiro,
sem mexer em componente. Fonte: `cp2b_web/src/styles/tokens.css`.

| Token Arqueia | Antes | Depois (CP2b) | Papel |
|---|---|---|---|
| `--arqueia-brand-900` | `#123f34` | `#1E3E4C` azul-petróleo | trilho, botão primário, `theme-color` |
| `--arqueia-brand-700` | `#176b55` | `#00573A` verde-escuro | texto de destaque, kicker |
| `--arqueia-brand-500` | `#2da77d` | `#5CA032` verde | **só** preenchimento/borda (3,2:1 com branco) |
| `--arqueia-accent` | `#d6f265` | `#B6E03B` lima | **só** sobre escuro |
| `--arqueia-canvas` | `#f4f6f3` | `#FBF8F0` papel | fundo |
| `--arqueia-line` | `#dfe6e1` | `#E6DCC6` | divisórias |
| `--arqueia-ink-950/800/600` | verdes escuros | `#1B2A33` / `#1E3E4C` / `#5A5850` | texto |

Junto com a troca de tokens:

- **Tokens que o CSS usava sem nunca definir** passam a existir: `--arqueia-shadow-md`,
  `--arqueia-brand-300/600` e `--arqueia-ink-200/500/700`. Antes, essas declarações eram
  ignoradas em silêncio.
- **Anel de foco:** o lima some sobre fundo claro (1,4:1). O anel passa a ser petróleo
  (`--arqueia-focus`), e continua lima só no trilho escuro.
- **Logos:** avatar oficial atual do CP2b (`cp2b-avatar-gradient.svg`), logo para fundo
  escuro na tela de login (`cp2b-logo-on-dark.svg`), ícones PWA na paleta nova e
  `theme-color` e `manifest` atualizados.
- **Service worker:** `arqueia-static-v5` e `arqueia-offline-v2`, para os celulares
  buscarem os ícones novos.

### Fora desta entrega (decisões pendentes)

- **Fontes Neulis Sans/Neue.** São comerciais e ficam no próprio site do CP2b. Antes de
  copiar os arquivos, confirmar que a licença cobre o Arqueia. Hoje o Arqueia cita "Inter"
  mas não carrega fonte nenhuma, então renderiza a fonte do sistema.
- **Botões em pílula e sombras "papel".** É a assinatura do site, mas muda o desenho de todas
  as telas. Fica para uma segunda passada, com o checklist de regressão visual.
- **Cerca de 180 hex literais** em `globals.css`, da paleta slate do Tailwind. A troca de
  tokens não os alcança. Migrar para tokens aos poucos, página a página.

---

## B. Informes pelo QR

### Fluxo

1. A coordenação abre **Informes → QR para imprimir** e cola o cartaz nas bancadas.
2. Quem escaneia abre `/informar?laboratory=<id>`, **sem login**, e escolhe o tipo:
   - **Problema em equipamento**
   - **Necessidade de manutenção**
   - **Uso de insumos ou reagentes**
   - **Informe geral / pedido de apoio**
3. Equipamento é opcional. "Isso impede o uso agora?" destaca o informe. Nome e contato são
   opcionais.
4. Quem envia recebe **só o protocolo** (`INF-XXXXXXXX`). Não vê nenhum informe, nem o
   próprio depois de enviado.
5. A coordenação vê em `/informes`:
   - o compilado por tipo, com o total em aberto e quantos dizem que um equipamento parou;
   - filtros por status e tipo;
   - a triagem de cada informe (**Novo → Em análise → Resolvido**, com nota interna).

### Quem lê: papel × laboratório, não categoria acadêmica

Alunos e pós-docs compartilham o papel `USUARIO` ("Usuário Pesquisador"). A categoria
acadêmica (`POS_DOUTORADO`, `PESQUISADOR`) **não pode** conceder permissão (ADR-009;
AGENTS.md §4.5). Por isso a leitura é uma permissão nova:

- `field-report.review` → `GESTOR_ACESSO_CP2B` (a coordenação) e `ADMIN`.
- **Não** vai para `USUARIO`. Um teste de contrato falha se alguém der a permissão a esse
  papel.
- **Não** vai para `TECNICO`, a pedido ("apenas pesquisadores e pós-doutorado"). Liberar
  para técnicos é uma linha em `permissions.ts` mais o teste.

> **Para funcionar em produção:** Lucas e os outros pós-docs que vão revisar precisam ter
> `GESTOR_ACESSO_CP2B` no laboratório, ou `ADMIN`.

### A primeira escrita pública: anti-abuso

Até aqui, o único controller sem `JwtAuthGuard` era a agenda pública, só leitura. O envio
de informes é o **segundo endpoint público** e, fora do login, o **único que grava conteúdo**. Controles, em
camadas:

| Camada | Controle |
|---|---|
| BFF (`/api/public/field-reports`) | mesma origem (`hasTrustedOrigin`); corpo ≤ 16 KiB; campo-armadilha (`website`): robô recebe "sucesso" e nada é gravado |
| Contrato | `submitFieldReportInputSchema.strict()` aceita só os campos do formulário; status, nota e revisor não entram |
| API | `FieldReportRateLimitGuard`: 10 envios por origem a cada 15 min, em memória; o BFF repassa o IP real |
| Banco | equipamento precisa ser do mesmo laboratório (FK composta); mensagem com no mínimo 10 caracteres úteis (CHECK) |
| Leitura | nenhuma rota pública lê informes; um teste de metadados garante que o controller público só tem `form` e `submit` |

### Dados, auditoria e LGPD

- **Conteúdo imutável:** um gatilho recusa `UPDATE` no que o remetente escreveu e recusa
  `DELETE`. A coordenação só muda triagem (status, nota, revisor, horário). Exclusão é
  arquivamento (§4.6).
- **Auditoria sem texto livre:** `audit_events` é append-only. A trilha guarda
  `field-report.submitted` e `field-report.reviewed`, com tipo, status e equipamento. Nunca
  guarda a mensagem, a nota ou o contato: gravá-los tornaria impossível atender a um pedido
  de eliminação.
- **Sem IP no banco** (ADR-009 §10). O limite de envios vive só na memória da API.
- **Uso de insumo é aviso, não movimento:** não grava `stock_movements` (§4.1). A coordenação
  lê o aviso e registra a retirada no Estoque.
- Documentos atualizados: `RBAC_MATRIX.md`, `USER-ROLES.md`, `DATA_INVENTORY.md`,
  `RETENTION_MATRIX.md` (prazo proposto: 2 anos após resolvido, a validar),
  `LGPD_COMPLIANCE_MATRIX.md` e `SECURITY.md`.

### Arquitetura (SOLID, §3)

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| contracts | `field-reports/field-report.ts` | fronteiras de envio público, formulário público e leitura restrita; protocolo |
| contracts | `identity/permissions.ts` | `field-report.review` → `GESTOR_ACESSO_CP2B` |
| database | `migrations/014_field_reports.cjs` | tabela, FK composta, CHECKs, índices, gatilho de imutabilidade |
| domain | `ports/field-report-repository.port.ts` | duas portas: `PublicFieldReportGateway` (envio) e `FieldReportReviewRepository` (leitura e triagem) |
| domain | `field-report-summary.ts` | regra pura do compilado ("em aberto" = Novo + Em análise) |
| application | 5 casos de uso | formulário público, envio, listagem, resumo, triagem (autoriza pelo lab **do informe**) |
| infrastructure | `postgres-field-report-repository.ts` | SQL parametrizado; auditoria na mesma transação |
| interface | `public-field-report.controller.ts` | `GET form`, `POST` com limite de envios; sem sessão |
| interface | `field-report.controller.ts` | `GET`, `GET summary`, `PATCH :id`; `JwtAuthGuard` |
| web | `/informar` | formulário público (em `PUBLIC_PATHS` do `proxy.ts`) |
| web | `/informes` | compilado e triagem; item "Informes" no menu só para quem tem a permissão |

Contrato de entrada e saída:

- `GET /api/public/field-reports/form?laboratoryId=` → `{ laboratory, equipment[] }` (200 | 404)
- `POST /api/public/field-reports` → `{ reference, receivedAt }` (201 | 400 | 404 | 429)
- `GET /api/field-reports?laboratoryId&kind?&status?&cursor?&limit?` → página (200 | 401 | 403)
- `GET /api/field-reports/summary?laboratoryId` → compilado (200 | 401 | 403)
- `PATCH /api/field-reports/:id` `{ status, reviewNote? }` → informe (200 | 401 | 403 | 404)

---

## Divisão em PRs pequenos

Cada linha é um commit coeso neste branch; dá para abrir como PRs separados, nesta ordem.

| # | Entrega | Executor | Domínio crítico? |
|---|---|---|---|
| 1 | Este plano | [O] | — |
| 2 | Tokens e logos do CP2b | [H] a partir da tabela acima | não |
| 3 | Contrato, permissão e migração 014 | [O] | sim: permissões e auditoria |
| 4 | Módulo `field-reports` da API | [O] | sim: escrita pública |
| 5 | Páginas `/informar` e `/informes`, QR e e2e | [H] a partir dos contratos | não |

## Critérios de aceite

1. Escanear o QR abre o formulário **sem login**, no celular, sem rolagem horizontal.
2. Os quatro tipos existem. O envio devolve só o protocolo.
3. Sem sessão, `/informes` redireciona ao login. `USUARIO` e `TECNICO` recebem 403 na API e
   não veem o item de menu.
4. `GESTOR_ACESSO_CP2B` vê o compilado do **seu** laboratório e tria; de outro lab, 403.
5. Campos de revisão enxertados no envio são recusados (400). O campo-armadilha preenchido
   não grava nada.
6. O 11º envio da mesma origem em 15 min recebe 429 com `Retry-After`.
7. `UPDATE` na mensagem ou `DELETE` de informe falham no banco (SQLSTATE 55000).
8. A auditoria não contém mensagem, nota nem contato.
9. Lint, typecheck, testes unitários e de integração, build e e2e verdes.

## Testes

- `contracts`:
  - fronteiras do envio e do formulário;
  - transformação de campos opcionais;
  - protocolo;
  - **só a coordenação revisa**.
- `database`:
  - invariantes da migração 014 (sem `ip_address`/`user_agent`);
  - guarda de integração com a 4ª suíte.
- `api`:
  - casos de uso com o `PermissionEvaluator` real (papéis × laboratório);
  - resumo puro;
  - SQL parametrizado;
  - guard de limite;
  - metadados dos controllers.
- `api` integração (Postgres `_test`):
  - envio e auditoria sem texto;
  - equipamento de outro lab;
  - gatilho de imutabilidade e DELETE;
  - triagem;
  - paginação.
- `web`:
  - BFF público (origem, armadilha, teto, repasse de IP, 429);
  - formulário;
  - página da coordenação (compilado, triagem, bloqueio para `USUARIO`);
  - construtor do QR.
- `e2e` (`tests/e2e/field-reports.spec.ts`), desktop e celular:
  - envio sem login;
  - `/informes` exige sessão;
  - a coordenação vê e tria.

## Próximos passos (fora deste escopo)

- **Notificar a coordenação** (e-mail pelo worker) quando chegar informe que impede o uso.
- **QR por equipamento** no diálogo de etiqueta: o construtor já aceita `equipmentId`, e
  `/informar?equipment=` já pré-seleciona o equipamento e o tipo.
- **Arquivar** spam, reaproveitando `archived_at`, com auditoria.
- **Foto anexada** e **transição de status do equipamento** (FR-EQP-5). Exige storage e
  revisão.
- **Limite de envios via Redis** se a API passar a rodar em mais de uma instância. Hoje é
  processo único no PM2.
- **Job de retenção** quando a UNICAMP validar o prazo.
