# AGENTS.md — Convenções de desenvolvimento (Arqueia)

Este documento é de leitura **obrigatória** antes de escrever qualquer código ou abrir qualquer PR neste repositório — seja o autor uma pessoa, o Claude Haiku ou o Claude Opus. Ele define como o trabalho é dividido, o padrão de arquitetura (SOLID) e o critério de "pronto".

---

## 1. Ciclo de trabalho: Plano → Desenvolvimento → Teste → Verificação

Toda tarefa segue o mesmo ciclo, e nenhuma etapa é opcional:

1. **Plano** — a tarefa existe em `docs/plan/` com escopo, contrato de entrada/saída e critérios de aceite. Se não existe contrato, ele é definido **antes** de codar (tarefa de Opus).
2. **Desenvolvimento** — implementação seguindo as camadas SOLID (§3). Um PR = uma unidade coesa de trabalho.
3. **Teste** — todo PR entra com testes. Regras em §5. PR sem teste não é mergeável.
4. **Verificação** — revisão de código + CI verde + checagem contra os "princípios não negociáveis" (§4). Mudanças em domínios críticos (estoque, controlados, reservas, permissões, auditoria) exigem revisão por Opus.

---

## 2. Divisão de trabalho: Claude Haiku vs Claude Opus

O critério é **quanto julgamento a tarefa exige**, não seu tamanho.

### Tarefas para **Claude Haiku** (baixa complexidade, bem-especificadas, mecânicas)

Pré-condição: existe um contrato/spec claro e a tarefa é determinística.

- Boilerplate e configuração (tsconfig, eslint, scaffolding de módulo a partir de um template).
- CRUD e endpoints derivados de um contrato já definido em `packages/contracts`.
- DTOs, mappers, validações declarativas (zod/class-validator) a partir de um schema.
- Componentes de UI a partir de uma spec de design já pronta.
- Testes unitários de funções puras com assinatura e casos dados.
- Arquivos de migração a partir de um schema já modelado.
- Seeds e dados de exemplo.
- Documentação de formatação, changelogs, tradução de textos de interface.

### Tarefas para **Claude Opus** (alta complexidade, exigem julgamento)

- Decisões de arquitetura e fronteiras entre módulos (ADRs).
- **Modelagem de dados** dos pontos sensíveis: livro-razão de estoque, Produto×Lote, concorrência de reservas, RBAC papel×lab, auditoria imutável, cadeia de custódia de controlados.
- Lógica de **transação e concorrência** (locks, constraints de exclusão, saldos).
- **Segurança**: autenticação, SSO/OIDC, autorização por menor privilégio, dupla autenticação de controlados.
- Definição dos **contratos** em `packages/contracts` (é a fonte da verdade que destrava o trabalho paralelo do Haiku).
- **Topologia de implantação** e runbook da VM.
- Revisão de código dos caminhos críticos.

### Regra de ouro
> Opus **congela contratos e modela os pontos sensíveis**. Haiku **preenche o mecânico bem-especificado** em cima desses contratos. Se uma tarefa "de Haiku" exigir uma decisão de modelagem, ela é reclassificada como Opus antes de prosseguir.

---

## 3. Arquitetura SOLID — organização por camadas

Cada módulo de domínio (`identity`, `inventory`, `controlled`, `equipment`, `scheduling`, `multiuser`, `management`) é organizado em quatro camadas. A dependência aponta **sempre para dentro** (interface → application → domain; infrastructure implementa portas do domínio).

```
module/
├─ domain/          # Entidades, value objects, regras de negócio puras, PORTAS (interfaces)
├─ application/     # Casos de uso (orquestram o domínio); um caso de uso = uma intenção
├─ infrastructure/  # Adaptadores: repositórios (Postgres), filas (Redis), e-mail, storage
└─ interface/       # Controllers HTTP, DTOs, mapeamento — a "casca" fina
```

Como isso mapeia para os cinco princípios SOLID:

- **S — Responsabilidade única:** um caso de uso faz uma coisa; um controller só traduz HTTP↔caso de uso; regra de negócio não vaza para o controller.
- **O — Aberto/fechado:** novas regras por equipamento (limite de reserva, treinamento obrigatório, aprovação) entram como estratégias, sem editar o motor de reservas.
- **L — Substituição de Liskov:** repositórios respeitam o contrato da porta do domínio; um repositório em memória (teste) substitui o de Postgres sem quebrar casos de uso.
- **I — Segregação de interface:** portas pequenas e específicas (`StockLedgerReader`, `StockLedgerWriter`) em vez de uma interface gorda.
- **D — Inversão de dependência:** o domínio define as portas; a infraestrutura as implementa. O domínio **não importa** Postgres, Redis, HTTP nem Next.

`packages/contracts` é a fronteira compartilhada entre `web`, `api` e `worker`: tipos e schemas vivem lá e ninguém redefine contrato localmente.

---

## 4. Princípios não negociáveis (checar na verificação)

Qualquer PR que viole um destes é rejeitado:

1. **Saldo de estoque é sempre derivado do livro de movimentações.** Proibido `UPDATE ... SET quantidade = X` como fonte de verdade.
2. **Produto e Lote são entidades distintas.** Validade/recebimento/quantidade moram no lote.
3. **Concorrência de reserva é resolvida no banco** (constraint de exclusão / lock), nunca só na UI.
4. **Toda ação sensível grava auditoria imutável** (ator, timestamp, origem, valores antes/depois). Auditoria é append-only.
5. **Autorização é papel × laboratório**, avaliada no servidor. Nunca confie no cliente.
6. **Exclusão é arquivamento** (soft-delete/archival) em dados operacionais.
7. **Controlados exigem autenticação adicional** e registram cadeia de custódia completa.
8. **Documentos são versionados** (autor, data, validade).
9. **Segredos nunca vão para o repositório.** Só `.env.example` é versionado.

---

## 5. Testes

- **Domínio e casos de uso:** cobertura alta, testes unitários (Vitest). São o coração — regras de estoque, reservas e permissões precisam de testes exaustivos.
- **Adaptadores/infra:** testes de integração contra Postgres/Redis efêmeros.
- **Fluxos críticos de UI:** Playwright (login/permissões, QR→retirada, reserva com conflito, retirada de controlado, portal multiusuário).
- Todo bug corrigido entra com um teste de regressão que falha antes do fix.

---

## 6. Convenções operacionais

- **Branches:** `feat/<modulo>-<curto>`, `fix/<curto>`, `chore/<curto>`, `docs/<curto>`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- **PR:** pequeno e coeso; descreve o quê e o porquê; referencia a tarefa do roadmap; inclui testes. Marcar se toca um domínio crítico (exige revisão Opus).
- **Migrações:** nunca editar uma migração já aplicada em homologação/produção; criar uma nova.
- **Ambientes:** `dev` → `homolog` → `prod` (ver `docs/deployment/ENVIRONMENTS.md`). Nada vai para `prod` sem passar por `homolog`.
