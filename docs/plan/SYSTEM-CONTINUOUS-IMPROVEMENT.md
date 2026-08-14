# Plano canônico — Evolução contínua do Arqueia

## 1. Objetivo e precedência

Este documento organiza a continuação do Arqueia a partir do estado observado em 14/08/2026. Ele complementa os planos de domínio existentes e passa a ser o índice de priorização entre eles. Regras específicas já congeladas em ADRs e planos de domínio continuam prevalecendo dentro de seu escopo.

O objetivo é evoluir o sistema de um MVP local funcional para uma plataforma operacional segura, observável, testada em banco real e pronta para homologação, sem antecipar controlados ou relatórios regulatórios antes das decisões externas necessárias.

Princípios de execução:

1. cada incremento percorre Plano → Desenvolvimento → Teste → Verificação;
2. contratos compartilhados são congelados antes de API, BFF e UI;
3. segurança, isolamento entre laboratórios, ledger e concorrência são gates, não melhorias opcionais;
4. nenhum recurso novo entra enquanto a baseline estiver vermelha;
5. migrações aplicadas nunca são reescritas;
6. cada entrega deve ser pequena, reversível e observável.

## 2. Baseline observada

Já existem contratos, migrações, API e interfaces para identidade, catálogo, equipamentos, reservas, estoque, dashboard, gestão e auditoria. A aplicação Web possui Home, Agenda, Estoque, Equipamentos, Usuários, Gestão e Guia. O worker ainda contém apenas fundação/configuração.

Pendências objetivas que influenciam a ordem:

- a suíte Web está vermelha no teste de Gestão que espera `62.5h`;
- adaptadores críticos ainda não possuem cobertura uniforme contra PostgreSQL real;
- o plano canônico de Gestão ainda descreve checkpoints de correção e endurecimento;
- MFA, ciclo seguro de sessão, SSO institucional e deploy em homologação não estão concluídos;
- QR operacional, ficha individual de lote/equipamento e e2e dos fluxos críticos ainda precisam ser fechados;
- alertas automáticos ainda não possuem motor no worker;
- controlados dependem de validação regulatória;
- custos, Excel/PDF e portal externo são posteriores à estabilização do núcleo.

Decisão de produto registrada em 14/08/2026: o Arqueia não terá mapas, geolocalização ou plantas interativas. Localizações serão representadas por cadastros textuais e hierárquicos de laboratório, espaço, bancada e ativo.

Antes de iniciar cada marco, reconfirmar esta baseline no código e registrar divergências no PR.

## 3. Ordem recomendada

| Prioridade | Marco | Resultado | Dependência |
|---|---|---|---|
| P0 | E0 — Baseline confiável | CI verde e testes reproduzíveis | nenhuma |
| P0 | E1 — Gestão endurecida | analytics/auditoria corretos e isolados | E0 |
| P0 | E2 — Segurança e sessões | autenticação e operação seguras | E0 |
| P1 | E3 — MVP operacional completo | estoque/QR/reservas utilizáveis ponta a ponta | E1, E2 |
| P1 | E4 — UX, acessibilidade e PWA | operação consistente em celular e desktop | E3 parcial |
| P1 | E5 — Homologação e observabilidade | deploy, backup e alertas operacionais | E2, E3 |
| P2 | E6 — Worker e notificações | alertas temporais idempotentes | E3, E5 |
| P2 | E7 — Operações avançadas | treinamento, manutenção e recorrência | E3, E6 |
| Gate externo | E8 — Controlados | cadeia de custódia validada | decisão regulatória |
| P3 | E9 — Portal, custos e exportações | expansão institucional | E5, modelagem financeira |

Não estimar datas antes de medir a vazão de E0 e E1. Usar marcos e gates, não calendário arbitrário.

## 4. E0 — Baseline confiável e dívida imediata

### Objetivo

Restabelecer uma linha de base totalmente verde e impedir que regressões visuais, contratuais ou de banco sejam incorporadas silenciosamente.

### Entregáveis

1. corrigir o teste Web de Gestão após confirmar se a fonte correta é o fixture ou a formatação atual;
2. executar `build`, `lint`, `typecheck` e testes de todos os workspaces em ambiente limpo;
3. classificar testes em unitário, integração e e2e, com comandos separados;
4. criar CI com jobs paralelos por pacote, cache de npm e um gate agregado;
5. adicionar PostgreSQL 16 e Redis efêmeros aos jobs de integração;
6. impedir commit de `dist`, cobertura, `.env` e artefatos locais;
7. registrar versão de Node/npm/Postgres/Redis usada pelo CI;
8. acrescentar smoke test de renderização autenticada da Home em 390 px e 1440 px;
9. criar checklist de regressão visual do `WorkspaceShell` e componentes compartilhados.

### Testes obrigatórios

- teste de regressão do indicador que hoje quebra a suíte Web;
- teste do logo com dimensões intrínsecas e CSS carregado;
- execução repetida da suíte para detectar flakiness;
- instalação limpa seguida de build completo;
- teste que falha se houver migrações duplicadas ou fora de ordem.

### Gate de saída

- todos os comandos raiz verdes em duas execuções consecutivas;
- zero teste ignorado sem justificativa e issue vinculada;
- duração e taxa de falhas do CI registradas;
- nenhum segredo ou artefato gerado versionado.

## 5. E1 — Conclusão e endurecimento de Gestão

Executar o plano `MANAGEMENT-DEVELOPMENT.md` como especificação detalhada. Este marco continua P0 porque analytics e auditoria lidam com isolamento, informação sensível e consultas potencialmente caras.

### Sequência

1. reconfirmar contratos de timezone, intervalo semiaberto, cursor opaco e limites;
2. tornar ator de sistema nullable de ponta a ponta;
3. separar a página de projetos do resumo de analytics;
4. substituir consultas por projeto por agregações set-based;
5. auditar a migração 006 em dev/homolog/prod e criar nova migração se necessário;
6. implementar sanitização fail-closed por tipo de entidade;
7. restringir `RESPONSAVEL_CONTROLADOS` a eventos de controlados, caso a matriz aprovada mantenha esse papel;
8. carregar analytics e auditoria de forma independente na UI;
9. respeitar `?laboratory=` e esconder Gestão sem permissão;
10. adicionar integração PostgreSQL com dois laboratórios e eventos globais.

### Métricas e limites

- período máximo: 90 dias;
- toda lista paginada e limitada no contrato;
- zero consulta N+1;
- plano de execução registrado para os datasets de referência;
- nenhuma resposta da API/BFF sem validação Zod;
- nenhum campo fora da allowlist no detalhe de auditoria.

### Gate de saída

Todos os critérios de pronto do plano de Gestão satisfeitos e testes de isolamento, cursor, ator nulo, falha parcial e ausência de vazamento aprovados.

## 6. E2 — Segurança, identidade e ciclo de sessão

### Decisões a congelar

- duração de access/refresh token, renovação, revogação e número máximo de sessões;
- provedor OIDC institucional e atributos confiáveis;
- fatores MFA aceitos e política de recuperação;
- quais ações exigem reautenticação recente;
- política de senha local e encerramento de senha temporária;
- retenção de logs de segurança e dados pessoais.

### Implementação

1. modelar sessão revogável e rotação de refresh token;
2. invalidar sessão no logout, troca de senha, desativação e revogação administrativa;
3. implementar MFA para administradores e ações críticas;
4. concluir OIDC com validação estrita de issuer, audience, nonce e state;
5. aplicar cookies `HttpOnly`, `Secure`, `SameSite` e proteção CSRF adequada ao fluxo;
6. adicionar rate limit a login, reautenticação e endpoints públicos;
7. padronizar respostas para evitar enumeração de contas;
8. auditar toda alteração de papel, membership e credencial;
9. adicionar headers de segurança e CSP compatível com Next;
10. documentar ameaça, resposta a incidente e rotação de segredos.

### Testes

- matriz papel × laboratório em API real;
- token expirado, revogado, reutilizado e de audience incorreta;
- CSRF, brute force, enumeração e acesso horizontal;
- MFA obrigatório e recuperação controlada;
- logout em múltiplas sessões;
- auditoria sem senha, token, segredo ou hash.

### Gate de saída

Threat model revisado; testes negativos verdes; nenhuma decisão de autorização tomada apenas no cliente; homologação usando TLS e segredos próprios.

## 7. E3 — MVP operacional completo: estoque, QR e reservas

### E3.1 Estoque e ledger

1. adicionar testes PostgreSQL reais para entrada, retirada, ajuste e concorrência;
2. garantir saldo derivado, nunca persistido como fonte de verdade;
3. rejeitar retirada que produza saldo inválido dentro da transação;
4. fechar ficha Produto × Lote, localização, validade e documentos;
5. implementar conversão de embalagem somente após contrato explícito de unidade;
6. criar QR versionado com identificador opaco e digitação manual;
7. implementar tela individual do lote com histórico paginado;
8. preparar política de arquivamento sem apagar histórico.

### E3.2 Equipamentos e reservas

1. testar a constraint de exclusão com duas conexões concorrentes;
2. fechar página individual do equipamento e documentos;
3. validar regras de duração, laboratório, status e proprietário no servidor;
4. melhorar Dia/Semana/Mês, timezone e navegação por URL;
5. tornar cancelamento auditável e idempotente;
6. fechar bloqueio técnico e sua precedência sobre reservas;
7. adicionar QR do equipamento para ficha e agenda.

### E3.3 Fluxos e2e

- login → QR → lote → retirada → saldo/histórico;
- login → equipamento → reserva → conflito concorrente → cancelamento;
- técnico → bloqueio → usuário impedido de reservar;
- usuário de Lab A impedido de acessar dados de Lab B;
- falha de rede com mensagem recuperável, sem duplicar mutações.

### Gate de saída

Os dois fluxos principais funcionam em dispositivo móvel real ou em viewport equivalente, com testes de integração do banco e Playwright no CI.

## 8. E4 — Qualidade de experiência, acessibilidade e PWA

### Sistema de interface

1. inventariar componentes e eliminar CSS global acidental;
2. criar tokens para dimensão, espaço, cor, foco e camadas;
3. adicionar documentação visual dos estados dos componentes;
4. padronizar loading, vazio, erro, sucesso e confirmação;
5. impedir mudanças de layout por imagens sem dimensões;
6. revisar navegação e ações por permissão sem substituir autorização no servidor.

### Acessibilidade

- WCAG 2.2 AA como alvo;
- navegação completa por teclado e foco restaurado em modais;
- nomes acessíveis, mensagens associadas e regiões de status;
- contraste, zoom a 200%, reduced motion e touch targets de 44 px;
- Axe automatizado e revisão manual dos fluxos principais.

### PWA e resiliência

1. definir explicitamente o que pode funcionar offline;
2. nunca armazenar payload sensível de auditoria ou controlados em cache público;
3. versionar service worker e apresentar atualização segura;
4. criar página offline útil e fila apenas para mutações que possam ser idempotentes;
5. testar instalação, atualização e limpeza de cache.

### Gate de saída

Sem violações críticas de acessibilidade; Core Web Vitals medidos; fluxos P0 aprovados em mobile e desktop; política de cache revisada por segurança.

## 9. E5 — Homologação, observabilidade e continuidade

### Infraestrutura

1. validar Apache versus nginx e atualizar o runbook;
2. provisionar homolog com banco, Redis, URLs e segredos exclusivos;
3. automatizar deploy com artefato imutável, migração e rollback de aplicação;
4. adicionar health, readiness e verificação de dependências;
5. aplicar migrações com lock e registro de versão;
6. executar smoke tests após deploy antes de promover.

### Observabilidade

- logs estruturados com request/correlation ID e sem dados sensíveis;
- métricas de latência, erro, pool de banco, jobs e filas;
- alertas para indisponibilidade, erro elevado, disco, certificado e backlog;
- rastreamento das rotas críticas e consultas lentas;
- dashboard operacional e runbook por alerta.

### Backup e continuidade

1. automatizar backup criptografado de banco e documentos;
2. definir RPO, RTO e retenção;
3. realizar restauração em ambiente isolado;
4. verificar consistência entre banco e documentos;
5. registrar evidência e tempo real de recuperação.

### Gate de saída

Deploy reproduzível em homolog; rollback ensaiado; restauração comprovada; alertas testados; promoção para produção ainda exige aprovação humana.

## 10. E6 — Worker, alertas e notificações

### Fundação

1. congelar contrato de job, versão do payload, idempotency key e política de retry;
2. usar outbox transacional para eventos derivados de mutações críticas;
3. implementar retries com backoff, dead-letter e replay auditado;
4. medir atraso, tentativas, falhas e itens em dead-letter;
5. separar cálculo temporal de entrega por canal.

### Primeiros jobs

- lotes vencidos ou próximos da validade no timezone do laboratório;
- estoque abaixo do mínimo;
- reserva no dia seguinte e em 30 minutos;
- manutenção/calibração próximas;
- liberação por ausência somente após contrato de check-in.

### Regras

- jobs idempotentes e seguros para reexecução;
- janelas `[startsAt, endsAt)` e timezone do laboratório;
- deduplicação por destinatário, evento, canal e janela;
- preferências e opt-out quando permitido;
- conteúdo sem dados excessivos.

### Gate de saída

Testes com relógio controlado, DST, retry e duplicidade; sandbox de e-mail; operação e replay documentados.

## 11. E7 — Operações avançadas

### Reservas recorrentes

Congelar semântica de recorrência, exceções, edição de série e conflitos parciais. Expandir ocorrências dentro de horizonte limitado, garantir conflitos no banco e reportar claramente datas aceitas/rejeitadas.

### Treinamento e habilitação

Modelar solicitação, aprovação, validade, revogação e evidência documental. Reserva deve consultar habilitação vigente na transação, respeitando a política de cada equipamento.

### Manutenção, calibração e incidentes

Criar entidades e transições explícitas; anexos seguros; alteração automática de disponibilidade quando aplicável; histórico imutável; documentos versionados; alertas pelo worker.

### Gate de saída

Testes de estratégia por equipamento, recorrência e concorrência; e2e de usuário não habilitado; rastreabilidade integral de manutenção e incidentes.

## 12. E8 — Controlados, condicionado a gate regulatório

Nenhum desenvolvimento de livro declarado como regulatório começa sem documento aprovado contendo substâncias, órgãos, responsáveis, campos, assinaturas, retenção e formato de exportação.

Após aprovação:

1. criar ADR de cadeia de custódia;
2. modelar `CustodyEvent` e movimento de estoque na mesma transação;
3. exigir reautenticação/MFA e autorização de menor privilégio;
4. preservar saldo anterior/posterior, ator, aprovador, origem e finalidade;
5. implementar append-only e controles contra alteração no banco;
6. restringir auditoria e exportações a eventos de controlados;
7. validar formalmente relatórios antes de chamá-los de livro válido.

Gate: revisão regulatória e de segurança, testes de que nenhuma retirada ocorre sem custódia completa e plano de contingência operacional.

## 13. E9 — Portal externo, custos e exportações

### Portal multiusuário

- contrato do workflow e transições autorizadas;
- token aleatório, escopado, expirável e armazenado como hash;
- rate limit, CAPTCHA somente se necessário, antispam e não enumeração;
- minimização LGPD, consentimentos/base legal e retenção;
- e2e de submissão, acompanhamento e expiração.

### Custos

Antes do código, decidir moeda, precisão, vigência de preço, impostos, embalagem, rateio, custo de equipamento e tratamento de ajustes. Custos devem ser derivados do ledger e de tabelas versionadas, nunca inferidos retroativamente sem versão.

### Excel/PDF

Contratos assíncronos no worker, snapshot consistente, limite de período, autorização no momento da solicitação e do download, expiração do arquivo e auditoria. Conferir totais exportados contra a API e o ledger.

## 14. Estratégia transversal de testes

### Pirâmide

1. domínio: regras puras e casos-limite;
2. aplicação: intenção, autorização e erros;
3. contratos: entrada, saída, compatibilidade e limites;
4. infraestrutura: PostgreSQL/Redis reais e concorrência;
5. API/BFF: autenticação, Zod, status e sanitização;
6. UI: estados e acessibilidade;
7. e2e: somente jornadas críticas e estáveis.

### Dados mínimos de integração

Todo cenário crítico deve conter dois laboratórios, dois usuários com papéis diferentes, registros globais quando aplicável, timestamps em limites do período, entidades arquivadas e tentativas de acesso cruzado.

### Gates de qualidade

- bug corrigido inclui regressão que falha antes do fix;
- mudanças de query incluem integração e plano de execução quando relevantes;
- mudanças de permissão incluem teste positivo e negativo;
- mudanças temporais incluem timezone e bordas;
- mudanças de UI incluem loading, vazio, erro e responsividade;
- nenhuma cobertura percentual isolada substitui cenários críticos.

## 15. Métricas de evolução

Registrar por release:

- taxa de sucesso e duração do CI;
- defeitos escapados e regressões por módulo;
- p50/p95/p99 e taxa de erro das rotas críticas;
- consultas lentas e saturação do pool;
- falhas/retries/dead-letter do worker;
- tempo de deploy e recuperação;
- sucesso dos fluxos QR, retirada e reserva;
- violações de isolamento ou segurança (meta: zero);
- acessibilidade crítica (meta: zero);
- restauração dentro de RPO/RTO.

## 16. Organização das entregas

Cada PR deve:

1. apontar para um checkpoint deste plano e para os FRs/ADRs aplicáveis;
2. declarar contrato de entrada/saída e migração, se houver;
3. permanecer coeso e evitar misturar refatoração ampla com comportamento novo;
4. incluir testes e evidência dos comandos executados;
5. declarar risco, rollback e impacto multi-laboratório;
6. exigir revisão especializada quando tocar identidade, permissões, ledger, reservas, auditoria ou controlados.

Trilhas que podem avançar em paralelo após E0:

- E1 Gestão e E2 Segurança, desde que contratos de identidade não sejam alterados simultaneamente sem coordenação;
- documentação/componentes não críticos de E4 durante E3;
- preparação de infraestrutura E5 durante E3, sem promover código não aprovado;
- descoberta regulatória de E8, sem implementação, em qualquer momento.

## 17. Próximos checkpoints concretos

1. **E0.1:** corrigir e estabilizar a suíte Web;
2. **E0.2:** criar matriz e comandos de unitário/integração/e2e no CI;
3. **E1.1:** auditar implementação versus `MANAGEMENT-DEVELOPMENT.md` e marcar cada requisito como atendido, parcial ou ausente;
4. **E1.2:** implementar integração PostgreSQL e remover N+1 de Gestão;
5. **E2.1:** escrever ADR de sessão/MFA/OIDC antes de alterar autenticação;
6. **E3.1:** fechar testes reais de ledger e concorrência de reservas;
7. **E3.2:** entregar QR → ficha → retirada e QR → equipamento → reserva em homolog;
8. **E5.1:** provisionar homolog e comprovar backup/restauração.

## 18. Definição global de pronto

Um marco só está concluído quando contrato, implementação, testes, documentação operacional e evidência de verificação concordam; a autorização é validada no servidor; o isolamento entre laboratórios está comprovado; migrações foram testadas do zero e incrementalmente; falhas possuem comportamento seguro; métricas e rollback existem; e nenhum item crítico foi adiado implicitamente.
