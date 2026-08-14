# Roadmap em Fases — Arqueia

O plano evolui de "protótipo em React" para **sistema operacional de laboratório, implantável e auditável**. A regra central é separar **MVP**, **requisitos regulatórios** e **expansões futuras**. Cada fase percorre o ciclo **Plano → Desenvolvimento → Teste → Verificação**.

Legenda de executor: **[O]** Claude Opus (julgamento) · **[H]** Claude Haiku (mecânico, bem-especificado). A matriz detalhada de tarefas, dependências e paralelização está em [`TASK-ORCHESTRATION.md`](TASK-ORCHESTRATION.md).

---

## Fase 0 — Descoberta e infraestrutura
**Objetivo:** base do projeto e decisões travadas.

- **[O]** Confirmar regras do NIPE e obrigações regulatórias (substâncias, órgãos, formato do livro).
- **[O]** Validar perfis, fluxos e prioridades com a equipe.
- **[O]** ADRs (feito: 001–005), arquitetura, modelo de dados, segurança.
- **[H]** Scaffold do monorepo, convenções, CI base.
- **[O]** Definir processo de homologação e produção.

**Saída:** repositório versionado + plano (este conteúdo) + esqueleto. **Verificação:** CI verde no scaffold; ADRs revisados.

> Estado: **em andamento** — este entregável cobre a documentação e o esqueleto.

---

## Fase 1 — Fundação
**Objetivo:** um sistema mínimo, porém real (com auth, banco, auditoria, deploy), no ar.

> **Marco local F1A:** fundação local funcional verificada; veja
> [`F1-LOCAL-FOUNDATION-VERIFICATION.md`](F1-LOCAL-FOUNDATION-VERIFICATION.md). Permanecem
> para concluir a fase: MFA/sessões, SSO institucional real e implantação em homologação.

- **[O]** Modelo de identidade (User/Laboratory/Project/Role/Membership) e RBAC papel×laboratório.
- **[O]** Autenticação (login local; ganchos para SSO/OIDC) e MFA para admin.
- **[O]** Fundação de auditoria imutável e de documentos versionados.
- **[H]** Migrações e seeds a partir do schema; CRUD de usuários/laboratórios/projetos a partir do contrato.
- **[H]** Design system base (`packages/ui`): navegação mobile (inferior + botão QR) e shell desktop (estilo Slack).
- **[O]** Implantação inicial na VM (Apache2 vhost, PM2, Postgres/Redis) + health checks.

**Saída:** login, gestão de usuários/labs/projetos, permissões, auditoria e deploy funcionando em homologação. **Verificação:** testes de autorização (papel×lab) no servidor; e2e de login; deploy reproduzível.

---

## Fase 2 — MVP operacional
**Objetivo:** o valor diário — estoque com QR e reservas.

- **[O]** Núcleo do **livro-razão de estoque** (`StockMovement`, saldo derivado, ajustes) — `ADR-004`.
- **[H]** Ficha de item, retirada, materiais de consumo (unidade/pacote/caixa) a partir do contrato.
- **[H]** Fluxo de QR Code (leitura + digitação manual) → ficha do item.
- **[O]** Núcleo de **reservas com constraint de exclusão** (`ADR-005`); conflitos.
- **[H]** Cadastro de equipamentos e páginas individuais; calendário Dia/Semana/Mês.
- **[H]** Dashboard operacional básico.

**Saída:** operar estoque por produto/lote/localização com QR e reservar equipamentos com bloqueio de conflito. **Verificação:** testes de concorrência de reserva; testes de saldo (ledger); e2e QR→retirada.

---

## Fase 3 — Operações avançadas
**Objetivo:** profissionalizar equipamentos e alertas.

- **[O]** Recorrência de reservas (expansão + validação por ocorrência); regras por equipamento (estratégias).
- **[O]** Habilitação/treinamento (bloqueio de não habilitado; workflow de solicitação).
- **[H]** Manutenções, calibrações e incidentes (histórico + reporte com foto + transição de status).
- **[O]** Motor de **alertas temporais** no worker: estoque mínimo, validade, calibração, "reserva em 30 min", liberação por ausência.
- **[H]** E-mails/notificações a partir de templates.

**Saída:** agenda profissional (recorrência, regras, treinamento) + alertas automáticos. **Verificação:** testes do worker (janelas temporais); e2e de reserva bloqueada por falta de habilitação.

---

## Fase 4 — Controlados (somente após validação regulatória)
**Objetivo:** cadeia de custódia e livro digital — **não inicia** antes de confirmar substâncias, órgãos e formato exigido (Fase 0).

- **[O]** Retirada com autenticação adicional (senha do responsável / aprovação por celular).
- **[O]** Cadeia de custódia (`CustodyEvent`) atrelada ao movimento na mesma transação.
- **[O]** Relatórios regulatórios e retenção; status "rascunho até validação formal".
- **[H]** Telas de armário de controlados e exportação.

**Saída:** módulo de controlados auditável. **Verificação:** revisão jurídica/regulatória do formato do livro **antes** de considerar válido; testes de que retirada de controlado sem custódia falha.

---

## Fase 5 — Multiusuário e gestão
**Objetivo:** abertura externa e inteligência de gestão.

- **[O]** Portal público de solicitação + workflow por estados; tokens não previsíveis.
- **[H]** Formulário externo e páginas de acompanhamento por link.
- **[O]** Custos por projeto (a partir do consumo do ledger).
- **[H]** Relatórios Excel/PDF; dashboards por perfil; notificações institucionais.

**Saída:** portal multiusuário + relatórios/custos. **Verificação:** testes de segurança do portal (rate limit, tokens); conferência de relatórios contra o ledger.

---

## Priorização do MVP (confirmar)
A ordem sugerida do primeiro valor entregue é: **login e permissões (F1) → estoque/QR (F2) → equipamentos/reservas (F2)**. As Fases 4 e 5 dependem de decisões externas (regulatório) e podem correr em paralelo à F3 quando destravadas.

## Perguntas ainda abertas (não bloqueiam F0/F1)
Estas afinam F2+ e devem ser respondidas ao longo da fundação: nº de usuários/equipamentos/itens no 1º ano; acesso só por rede/VPN da Unicamp; SSO institucional disponível; substâncias/órgãos de controlados; QR offline; leitores USB; canais de notificação no MVP; identidade visual (logo/cores) existente.
