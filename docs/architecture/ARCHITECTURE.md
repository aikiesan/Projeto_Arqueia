# Arquitetura — Arqueia

## 1. Visão geral

Monorepo TypeScript com três aplicações que compartilham contratos, executadas **nativamente** (sem Docker) na VM Debian do CP2b, atrás do Apache2 já existente.

```
                      Internet (TLS via Let's Encrypt, cert já existente)
                                     │
                          ┌──────────┴───────────┐
                          │   Apache2 (proxy)     │   VirtualHosts:
                          │   na VM Debian        │   cp2b.unicamp.br        → site atual (inalterado)
                          └──────────┬───────────┘   arqueia.cp2b.unicamp.br → Arqueia
                     ┌───────────────┼────────────────┐
              ProxyPass /api/   ProxyPass /           (WebSocket upgrade p/ Next)
                     │               │
             ┌───────▼──────┐  ┌─────▼───────┐   ┌──────────────┐
             │  api (Nest)  │  │  web (Next) │   │ worker (Node)│   ← todos via PM2
             │  :4001       │  │  :4002      │   │  filas       │
             └──────┬───────┘  └─────────────┘   └──────┬───────┘
                    │                                    │
            ┌───────▼─────────────────────────────┬─────▼──────┐
            │ PostgreSQL (:5432, nativo apt)       │ Redis (:6379, nativo apt) │
            └─────────────────────────────────────┴───────────────────────────┘
```

Portas propostas (evitam colisão com o cp2b, que usa 3001): **api 4001**, **web 4002**, worker sem porta pública. Ajustar em `infrastructure/pm2/ecosystem.config.js`.

## 2. Aplicações

- **`apps/api` (NestJS):** API modular por domínio. Cada módulo segue as 4 camadas SOLID (domain/application/infrastructure/interface — ver `AGENTS.md` §3). Expõe REST sob `/api`.
- **`apps/web` (Next.js):** PWA responsivo. Mobile-first para operação (navegação inferior: Início, Agenda, Estoque, Mais; botão central de QR; fluxos curtos, uso com uma mão; digitação manual como alternativa à câmera). Desktop-first para gestão (inspiração Slack: barra lateral de laboratórios, segunda barra de módulos/filtros, área central, painel contextual à direita e menu de comandos do usuário; a busca global será introduzida na fase de indexação unificada e o placeholder temporário da TopBar foi removido).

- **`apps/worker` (Node):** consome filas Redis para trabalho assíncrono: e-mails, notificações, alertas temporais (estoque mínimo, validade, calibração, "reserva começa em 30 min", liberação por ausência) e geração de relatórios Excel/PDF.

## 3. Pacotes compartilhados

- **`packages/contracts`** — **fonte da verdade** de tipos e schemas (DTOs, validações). `web`, `api` e `worker` importam daqui; ninguém redefine contrato localmente. É o artefato que o Opus congela para destravar o trabalho paralelo do Haiku.
- **`packages/database`** — schema, migrações, seeds e implementações de repositório (adaptadores Postgres das portas do domínio).
- **`packages/ui`** — design system compartilhado (tokens, componentes base, padrões mobile/desktop).
- **`packages/config`** — presets de ESLint, TSConfig, e schema de variáveis de ambiente.

## 4. Módulos de domínio (bounded contexts)

Mapeiam 1:1 com os 6 módulos de produto, mais Identidade como base transversal:

| Contexto | Responsabilidade |
|---|---|
| `identity` | Usuários, instituições, laboratórios, projetos, papéis e permissões por contexto. |
| `inventory` | Produtos, lotes, localizações, unidades, livro de movimentações, validade, estoque mínimo, soluções preparadas. |
| `controlled` | Cadeia de custódia, autorização adicional, justificativas, anexos, exportação do livro. |
| `equipment` | Cadastro, status, documentos versionados, habilitação/treinamento, incidentes, manutenção, calibração. |
| `scheduling` | Reservas, recorrência, aprovação, conflitos (lock no banco), bloqueios técnicos, check-in, liberação. |
| `multiuser` | Solicitação externa, triagem, comunicação, agendamento e acompanhamento por token. |
| `management` | Dashboards, alertas, consumo, custos, auditoria e exportações. |

`inventory` e `controlled` compartilham o mesmo livro-razão; `controlled` adiciona a camada de autorização e custódia sobre ele.

## 5. Fluxo de dependências (SOLID)

- O **domínio** define entidades, regras e **portas** (interfaces) e não importa Postgres/Redis/HTTP.
- **Aplicação** orquestra o domínio em casos de uso.
- **Infraestrutura** implementa as portas (repositórios Postgres, produtores/consumidores Redis, e-mail, storage).
- **Interface** (controllers Nest, páginas Next) é uma casca fina que traduz protocolo ↔ caso de uso.

Isto permite testar domínio e casos de uso com adaptadores em memória e trocar infraestrutura sem tocar em regra de negócio.

## 6. Sem Docker: modelo de processos

Como a VM não roda Docker (`ADR-001`), os serviços são nativos:

- **PostgreSQL** e **Redis** instalados via `apt` e gerenciados por `systemd`.
- **api / web / worker** gerenciados por **PM2** (`pm2 save` + `pm2 startup` para sobreviver a reboot), espelhando o fluxo que a equipe já usa no cp2b (`git pull` → `npm install` → `npm run build` → `pm2 restart`).
- Deploy e setup roteirizados em `infrastructure/scripts/` — ver [`../deployment/VM-DEPLOYMENT.md`](../deployment/VM-DEPLOYMENT.md).

## 7. Nota regulatória

O módulo `controlled` produz um "livro digital" (FR-CTL-4). Ele **não** deve ser tratado como registro juridicamente válido até validação formal do responsável regulatório. A implementação da Fase 4 só começa após confirmação das substâncias, órgãos e formato de livro exigidos — ver `ROADMAP.md`.
