# Plano — Visão Geral e Home autenticada

## Objetivo

Transformar a home atual, hoje parcialmente demonstrativa, em um painel operacional real, responsivo e adaptado ao papel do usuário e ao laboratório selecionado. Nenhum indicador poderá ser apresentado como real se não vier da API.

## Escopo do primeiro release

- Saudação e identidade do usuário autenticado.
- Laboratório ativo e troca de laboratório respeitando as memberships.
- Resumo de equipamentos: disponíveis, em uso, manutenção e avaliação.
- Próximas reservas do usuário e agenda do dia do laboratório, quando o módulo de agenda estiver disponível.
- Alertas operacionais disponíveis: manutenção/calibração e, depois do ledger, estoque baixo e validade.
- Atalhos para QR, equipamento, agenda e estoque.
- Estados de carregamento, vazio, indisponibilidade parcial e falta de permissão.
- Layout mobile para ação rápida e desktop para visão detalhada.

## Fora do primeiro release

- Gráficos históricos e custos.
- Indicadores regulatórios.
- Dados de estoque simulados.
- Personalização livre de widgets.

## Contrato antes da UI

Criar em `packages/contracts` um contrato de leitura `DashboardSummary`, escopado por laboratório e período, contendo somente projeções necessárias à tela. O servidor calcula e filtra o conteúdo; a UI nunca decide autorização.

Blocos previstos:

- `viewer`: usuário e papel no laboratório ativo;
- `equipmentSummary`: totais por status;
- `todayReservations`: lista resumida, vazia até Agenda estar operacional;
- `upcomingActions`: manutenções, calibrações e aprovações autorizadas;
- `inventoryAlerts`: vazio até o ledger ser implementado;
- `generatedAt`: horário da projeção para comunicar atualidade dos dados.

## Checkpoints curtos

### H1 — Remover demonstrações enganosas

- Substituir números e reservas fixas por estados vazios claramente identificados.
- Preservar o desenho atual e a identidade Arqueia + CP2b.
- Testar apresentação por usuário e laboratório.

**Aceite:** nenhuma informação fictícia aparece como dado operacional.

### H2 — Contrato e endpoint de resumo

- Congelar schemas Zod e tipos compartilhados.
- Criar caso de uso `GetLaboratoryDashboardSummary` no módulo `management`.
- Criar portas de leitura pequenas para equipamentos e identidade.
- Expor `GET /api/laboratories/:laboratoryId/dashboard`.
- Aplicar RBAC papel × laboratório no servidor.

**Aceite:** usuário sem membership recebe acesso negado; administrador e membro recebem apenas dados permitidos.

### H3 — Home com dados reais

- Criar rota BFF validando parâmetros e resposta pelo contrato.
- Carregar o resumo server-side, sem expor o token ao navegador.
- Conectar cartões de equipamentos e contexto do laboratório.
- Tratar falha parcial sem derrubar toda a home.

**Aceite:** o estado da tela corresponde ao banco e permanece utilizável quando um bloco não está disponível.

### H4 — Integração progressiva

- Após Agenda: preencher reservas de hoje e próxima reserva.
- Após Estoque/Ledger: preencher estoque baixo e validade usando saldo derivado.
- Após Manutenção: preencher calibrações e manutenções próximas.

**Aceite:** cada integração entra separadamente, com teste e sem alterar o contrato de forma incompatível.

## Testes e verificação

- Vitest: projeção por papel, laboratório vazio e dados parciais.
- Integração: endpoint e isolamento entre laboratórios.
- Playwright: login → home, troca de laboratório e atalhos principais.
- Typecheck, lint, testes e build.
- Verificar ausência de dados fictícios, vazamento entre laboratórios e decisões de autorização no cliente.

## Definição de pronto

A home mostra somente informações reais e autorizadas, funciona bem em mobile e desktop, possui estados vazios úteis e está preparada para receber Agenda e Estoque sem reescrita estrutural.
