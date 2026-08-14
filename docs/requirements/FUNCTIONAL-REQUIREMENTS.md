# Requisitos Funcionais — Arqueia

Consolidação da visão de produto em requisitos estruturados por módulo, com critérios de aceite. Cada requisito recebe um ID (`FR-<módulo>-<n>`) para rastreabilidade com o roadmap e os testes.

Módulos: **IDN** Identidade · **EST** Estoque · **CTL** Controlados · **EQP** Equipamentos · **AGD** Agenda · **MUS** Multiusuário · **GES** Gestão.

---

## IDN — Identidade, login e perfis

**FR-IDN-1 — Autenticação.** Área interna acessada por login e senha, vinculada ao usuário do laboratório. Suporte futuro a SSO/OIDC institucional; contas locais como contingência.

**FR-IDN-2 — Cadastro de usuário.** Campos: nome, e-mail institucional, instituição, laboratório, responsável/supervisor, perfil de acesso.

**FR-IDN-3 — Perfis de acesso (papel × laboratório).**
- **Usuário:** consulta estoque, retira materiais, reserva equipamentos.
- **Técnico:** gerencia equipamentos, aprova solicitações, controla manutenção e estoque, acompanha consumo e usuários **do(s) laboratório(s) sob sua responsabilidade**.
- **Administrador:** configura usuários, permissões, equipamentos, reagentes e relatórios.

**Critério de aceite:** funcionalidades administrativas ficam ocultas/negadas para quem não tem papel; a autorização é avaliada no servidor por papel **e** laboratório. Ver matriz completa em [`USER-ROLES.md`](USER-ROLES.md).

---

## EST — Controle de reagentes e materiais (QR Code)

**FR-EST-1 — QR Code por item/lote.** Cada reagente, material ou lote tem um QR Code individual; ao escanear pelo celular, o usuário abre a ficha do item. Deve haver **digitação manual do código** como alternativa à câmera.

**FR-EST-2 — Ficha do reagente.** Campos: fabricante, número CAS, lote, data de recebimento, data de abertura, data de validade, quantidade inicial, quantidade atual, unidade (mL, L, g, kg…), localização (laboratório → armário → prateleira), responsável pela compra, FISPQ/FDS, classificação de risco, observações.

**FR-EST-3 — Retirada de reagente.** Ação "Retirar" informando quantidade e finalidade/projeto; o sistema atualiza o saldo. O saldo é **derivado do livro de movimentações** (ver `ADR-004`), não editado diretamente.

**FR-EST-4 — Materiais de consumo.** Mesmo fluxo para ponteiras, tubos Falcon/Eppendorf, luvas, filtros, seringas, membranas, kits, colunas, padrões, gases, meios de cultura, peças de reposição etc. Permite retirada por **unidade, pacote ou caixa** (conversão de unidades de embalagem).

**FR-EST-5 — Estoque mínimo e alerta.** Cada item define estoque mínimo e atual. Ao atingir o limite: aviso "⚠️ Estoque baixo — compra recomendada" e e-mail automático ao técnico.

**FR-EST-6 — Controle de validade.** Monitorar reagentes, padrões analíticos, kits, meios e soluções preparadas. Alertas de proximidade ("vence em N dias") e de vencidos.

**FR-EST-7 — Soluções preparadas.** Cadastro de soluções preparadas no laboratório (ex.: NaOH 1 mol/L) com QR Code próprio: responsável pelo preparo, data, concentração, validade, **lote dos reagentes utilizados** e protocolo — garantindo rastreabilidade experimental.

---

## CTL — Reagentes controlados

**FR-CTL-1 — Separação de controlados.** Reagentes sujeitos a controle são claramente separados. Conforme política, o usuário comum pode visualizar a existência do reagente, mas **não pode registrar retirada sem autorização**.

**FR-CTL-2 — Retirada autenticada.** Ao escanear o QR do armário de controlados: "🔒 Reagente sujeito a controle — autenticação necessária". O sistema exige autenticação adicional: do responsável pela retirada e/ou autorização pelo celular do responsável.

**FR-CTL-3 — Cadeia de custódia.** Toda movimentação de controlado registra automaticamente: quem retirou, data, horário, quantidade, lote, finalidade, projeto, **saldo anterior e saldo posterior**. Exemplo do registro:

```
11/08/2026 – 09:42
Usuário: João Silva
Reagente: Acetona – lote X354
Quantidade: 500 mL   Projeto: CP2b-04
Saldo anterior: 4,5 L   Saldo atual: 4,0 L
```

**FR-CTL-4 — Livro digital de movimentação.** As movimentações compõem um livro digital. Relatórios podem depois ser adaptados aos registros regulatórios exigidos, conforme substâncias e órgãos aplicáveis. **Aviso legal:** o livro digital não é considerado juridicamente válido antes da validação formal pelo responsável regulatório (ver `ADR` e §7 do plano de arquitetura).

---

## EQP — Equipamentos

**FR-EQP-1 — Página individual do equipamento.** Ex.: "HPLC Shimadzu LC-2030 · 📍 Lab CP2b Sala 02 · Status 🟢 Disponível · Responsável: Técnico X". Contém documentos (manual, POP, preparo de amostras), características (detector, colunas, limites operacionais) e ações: Reservar, Solicitar treinamento, Reportar problema, Solicitar análise multiusuário.

**FR-EQP-2 — QR Code físico no equipamento.** Ao escanear: agenda, status, manual, POP, contato do técnico, próxima manutenção, próxima calibração, botão Reservar e botão Reportar problema.

**FR-EQP-3 — Usuários habilitados.** Marca quem está habilitado a operar cada equipamento (✓ habilitado / ✗ treinamento pendente). Usuário não habilitado é bloqueado ao tentar reservar: "Você ainda não possui autorização para operar este equipamento. Solicite treinamento."

**FR-EQP-4 — Solicitação de treinamento.** Ação "Solicitar treinamento" no equipamento → vai ao técnico responsável → técnico aprova, agenda e, após o treinamento, marca "✅ Usuário habilitado".

**FR-EQP-5 — Reportar problema.** Durante/após o uso: categorias (não liga, erro de software, resultado inconsistente, vazamento, necessidade de manutenção, consumível acabando, outro), com foto opcional. Ao reportar, o status pode mudar automaticamente: 🟢 Disponível → 🟡 Em avaliação → 🔴 Indisponível.

**FR-EQP-6 — Manutenção e calibração.** Histórico de manutenções (preventiva/corretiva, troca de peças) e calibrações (última/próxima). Alerta ao técnico ("⚠️ Calibração do TOC vence em 15 dias").

**FR-EQP-7 — Documentos e POPs.** Cada equipamento e reagente pode ter documentos associados (POP, manual, FDS/FISPQ, vídeo de treinamento, procedimento de emergência, formulário de manutenção), acessíveis pelo QR Code. Documentos são **versionados** (autor, data, validade).

---

## AGD — Agenda de reservas

**FR-AGD-1 — Reserva de equipamento.** Equipamentos → Reservar → lista de disponíveis (ex.: HPLC, GC, TOC) → calendário do equipamento com visões Dia/Semana/Mês → clicar no horário. Campos da reserva: usuário, projeto, descrição do uso, número de amostras, observações.

**FR-AGD-2 — Reservas recorrentes.** Repetição: Não repetir / Diária / Semanal / Quinzenal / Mensal / Personalizado. Personalizado permite ex.: "segundas, quartas e sextas, 08:00–10:00, até 30/11/2026".

**FR-AGD-3 — Detecção de conflitos.** O sistema verifica conflitos automaticamente. Em recorrência, reserva as datas livres e reporta as ocupadas ("⚠️ Existem conflitos em 18/09 e 25/09"). A verificação é garantida **no banco** (ver `ADR-005`).

**FR-AGD-4 — Regras por equipamento.** Cada equipamento tem regras próprias: reserva máxima (h), treinamento obrigatório (sim/não), aprovação do técnico (sim/não). Ex.: HPLC — máx 12h, treinamento sim, aprovação não; ICP-OES — máx 6h, treinamento sim, aprovação sim.

**FR-AGD-5 — Check-in e liberação por ausência.** Se o usuário não iniciar o uso em 30 minutos, a reserva pode ser liberada automaticamente. (Janela configurável por equipamento.)

---

## MUS — Multiusuário (portal externo)

**FR-MUS-1 — Portal público de solicitação.** Pesquisadores externos solicitam uso/análise **sem criar conta**. Campos: nome, e-mail, instituição, laboratório, responsável/orientador, equipamento desejado, data/horário desejados, número de amostras, tipo de amostra, tipo de análise, observações.

**FR-MUS-2 — Notificação e protocolo.** Ao enviar: "✅ Solicitação registrada" e e-mail automático ao técnico responsável.

**FR-MUS-3 — Workflow da solicitação.** Estados: Enviada → Em análise → (Informações adicionais solicitadas) → Aprovada → Agendada → Análise realizada → Concluída.

**FR-MUS-4 — Acompanhamento por token.** O solicitante acompanha por um link seguro enviado por e-mail, sem login. Links não podem ser previsíveis (token não-sequencial).

---

## GES — Gestão

**FR-GES-1 — Dashboard do laboratório.** "Hoje no laboratório": equipamentos reservados, indisponíveis, reagentes com estoque baixo, reagentes próximos da validade, solicitações multiusuário, manutenções próximas. Painel adaptado ao perfil.

**FR-GES-2 — Relatórios (Excel/PDF).** Disponíveis a técnico e administrativo. Ex.: consumo de reagentes por período; qual projeto/laboratório consumiu mais; **custo aproximado por projeto**.

**FR-GES-3 — Histórico e auditoria.** Consulta ao histórico de movimentações, reservas, manutenções e eventos de auditoria.

**FR-GES-4 — Notificações automáticas.** Por app e/ou e-mail: lembrete de reserva ("reservado amanhã às 09:00"; "começa em 30 minutos"), treinamento aprovado, pedido multiusuário aprovado, estoque abaixo do mínimo, calibração vencendo. Regras temporais processadas pelo worker.

---

## Requisitos não-funcionais (resumo)

Detalhados em [`../architecture/SECURITY.md`](../architecture/SECURITY.md).

- **Mobile-first** para operação diária; **desktop-first** (inspiração Slack) para gestão. PWA instalável.
- **Segurança:** menor privilégio, MFA para admin e operações críticas, auditoria imutável, TLS, proteção contra links públicos previsíveis.
- **LGPD:** política de retenção, anonimização e tratamento de dados pessoais.
- **Operação:** backup automático de banco e documentos, restauração testada, monitoramento (saúde, erros, disco, validade de certificado).
- **Ambientes** separados: desenvolvimento, homologação e produção.
- **Multi-laboratório** desde a modelagem, mesmo com uso inicial em um único laboratório.
