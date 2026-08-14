# Matriz de Orquestração — Haiku × Opus, paralelismo e dependências

Como dividir o trabalho entre **Claude Opus** (alta complexidade, julgamento) e **Claude Haiku** (baixa complexidade, mecânico e bem-especificado), o que roda **em paralelo** e o que **bloqueia** o quê.

## Princípio de orquestração

```
        OPUS congela o CONTRATO e modela o ponto sensível
                          │
        ┌─────────────────┼─────────────────────────────┐
        ▼                 ▼                               ▼
   HAIKU preenche    HAIKU preenche                 HAIKU preenche
   (em paralelo)     (em paralelo)                  (em paralelo)
        └─────────────────┴─────────────────────────────┘
                          │
                 OPUS revisa caminhos críticos → Verificação
```

Regra de reclassificação: se uma tarefa marcada **[H]** exigir uma decisão de modelagem/segurança, ela **vira [O]** antes de continuar. Nunca deixe o mecânico decidir o sensível.

## O que gate o paralelismo: os "contratos-âncora" (todos [O])

Estes artefatos, quando congelados, liberam várias tarefas Haiku simultâneas. São a prioridade de cada fase:

| Âncora [O] | Destrava (em paralelo) |
|---|---|
| `packages/contracts` de Identidade | CRUD usuários/labs/projetos, telas de cadastro, seeds |
| Schema + migração base | todas as migrações e repositórios derivados |
| Contrato de Estoque + regras do ledger | ficha de item, retirada, QR, materiais de consumo |
| Contrato de Reservas + constraint | calendário, telas de reserva, dashboard |
| Contrato de Equipamentos | páginas de equipamento, documentos, manutenção |
| Contrato do Portal externo | formulário público, páginas de acompanhamento |

---

## Tracks paralelos (após a Fundação)

Depois que a Fase 1 fecha identidade + auth + deploy, abrem-se cinco tracks que correm **em paralelo**, cada um com um par Opus(núcleo)/Haiku(preenchimento):

- **Track A — Identidade & Acesso** (base; entrega primeiro)
- **Track B — Estoque / Ledger** (depende de A para escopo de lab)
- **Track C — Equipamentos & Agenda** (depende de A; B e C são independentes entre si)
- **Track D — Infra & Deploy** (paralelo desde o início; entrega a esteira)
- **Track E — Design System / PWA** (paralelo desde o início; alimenta B e C)

Grafo de dependências (resumido):
```
D (infra)  ─────────────────────────► esteira p/ todos
E (UI)     ─────────────────────────► componentes p/ B, C
A (identidade+auth)  ──► B (estoque) ──► CTL (controlados, Fase 4, gated por regulatório)
                     └─► C (equip+agenda) ──► alertas (Fase 3)
B + C ────────────────────────────────► GES (gestão/relatórios, Fase 5)
```

---

## Matriz por fase

### Fase 0 — Descoberta e infraestrutura
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| ADRs, arquitetura, modelo de dados, segurança | O | Alta | — | — |
| Confirmar regras regulatórias e perfis (NIPE) | O | Alta | stakeholders | ✔ |
| Scaffold monorepo + convenções + CI base | H | Baixa | ADR-003 | ✔ |
| Presets `packages/config` (eslint/tsconfig/env) | H | Baixa | scaffold | ✔ |

### Fase 1 — Fundação
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| Modelo identidade + RBAC papel×lab (contrato) | O | Alta | F0 | — (âncora) |
| Autenticação + MFA admin; ganchos SSO/OIDC | O | Alta | identidade | ✔ (com deploy) |
| Auditoria imutável + documentos versionados | O | Alta | schema base | ✔ |
| Migrações + seeds a partir do schema | H | Baixa | schema | ✔ |
| CRUD usuários/labs/projetos a partir do contrato | H | Baixa | contrato identidade | ✔ |
| Design system base (nav mobile + shell desktop) | H | Média | `packages/ui` | ✔ (Track E) |
| Deploy inicial VM (vhost, PM2, PG/Redis, health) | O | Alta | scaffold | ✔ (Track D) |
| Scripts `setup-vm.sh`/`deploy-vm.sh` | H | Baixa | topologia [O] | ✔ |

### Fase 2 — MVP operacional
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| Núcleo do ledger (StockMovement, saldo, ajuste) | O | Alta | F1 | — (âncora B) |
| Contrato de Estoque (produto/lote/movimento) | O | Alta | ledger | — |
| Ficha de item + retirada + finalidade/projeto | H | Baixa | contrato estoque | ✔ |
| Materiais de consumo (unidade/pacote/caixa) | H | Baixa | contrato estoque | ✔ |
| Fluxo QR (câmera + digitação manual) → ficha | H | Média | contrato estoque | ✔ |
| Núcleo de reservas + constraint de exclusão | O | Alta | F1 | — (âncora C) |
| Cadastro de equipamentos + página individual | H | Baixa | contrato equip | ✔ |
| Calendário Dia/Semana/Mês + criar reserva | H | Média | contrato reservas | ✔ |
| Dashboard operacional básico | H | Baixa | contratos B/C | ✔ |

### Fase 3 — Operações avançadas
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| Recorrência (expansão + validação por ocorrência) | O | Alta | reservas | ✔ |
| Regras por equipamento (estratégias, aberto/fechado) | O | Média | reservas | ✔ |
| Habilitação/treinamento + bloqueio de não habilitado | O | Média | equip+identidade | ✔ |
| Manutenção/calibração/incidentes (histórico+foto) | H | Baixa | contrato equip | ✔ |
| Motor de alertas temporais (worker) | O | Alta | ledger+agenda | ✔ (Track D/worker) |
| Templates de e-mail/notificação | H | Baixa | contrato notificações | ✔ |

### Fase 4 — Controlados (gated por regulatório)
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| Retirada com autenticação adicional | O | Alta | ledger + Fase 0 regulatório | — |
| Cadeia de custódia (CustodyEvent na transação) | O | Alta | ledger | — |
| Relatórios regulatórios + retenção + status livro | O | Alta | custódia | ✔ |
| Telas de armário de controlados + exportação | H | Baixa | contratos acima | ✔ |

### Fase 5 — Multiusuário e gestão
| Tarefa | Exec | Complex. | Depende de | Paralelo? |
|---|:--:|:--:|---|:--:|
| Portal público + workflow por estados + tokens | O | Alta | F1 | ✔ |
| Formulário externo + acompanhamento por link | H | Baixa | contrato portal | ✔ |
| Custos por projeto (a partir do ledger) | O | Média | ledger | ✔ |
| Relatórios Excel/PDF + dashboards por perfil | H | Média | contratos B/C | ✔ |

---

## Definição de "pronto" por tarefa (aplica a H e O)
1. Segue as camadas SOLID e os princípios não negociáveis (`AGENTS.md` §3–§4).
2. Testes conforme `AGENTS.md` §5 (domínio/uso, integração, e/ou e2e crítico).
3. CI verde.
4. Se toca domínio crítico (estoque, controlados, reservas, permissões, auditoria): **revisão por Opus** na Verificação.
5. Documentação/contrato atualizados quando o contrato mudou.

## Como despachar cada ciclo
1. **Plano:** Opus escreve/atualiza o contrato-âncora e a spec da tarefa.
2. **Desenvolvimento:** Haiku executa as tarefas [H] destravadas, em paralelo; Opus faz os núcleos [O].
3. **Teste:** cada PR entra com testes.
4. **Verificação:** CI + revisão de Opus nos caminhos críticos; então merge e o ciclo avança.
