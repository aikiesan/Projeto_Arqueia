# Papéis e Permissões — Arqueia

A autorização é sempre avaliada **no servidor** e sempre na dimensão **papel × laboratório**. Um usuário pode ter papéis diferentes em laboratórios diferentes (ex.: Técnico no BIOMA, Usuário no CP2b). O Administrador de sistema é global; o Técnico é escopado ao(s) seu(s) laboratório(s).

## Papéis

| Papel | Escopo | Descrição |
|---|---|---|
| **Usuário** | Laboratório | Opera no dia a dia: consulta, retira materiais, reserva equipamentos. |
| **Técnico** | Laboratório | Gestão operacional do seu laboratório: equipamentos, estoque, aprovações, manutenção, treinamento, consumo. |
| **Administrador** | Sistema | Configura usuários, permissões, catálogos e relatórios em todos os laboratórios. |
| **Responsável por controlados** | Laboratório | Papel adicional que autoriza retirada de controlados e valida o livro (pode coincidir com Técnico). |
| **Solicitante externo** | Sem conta | Acesso apenas ao portal multiusuário via token; não entra no ambiente interno. |

## Matriz de permissões (resumo)

Legenda: ✅ permitido · 🟡 permitido com condição · ❌ negado

| Ação | Usuário | Técnico | Admin |
|---|:--:|:--:|:--:|
| Consultar estoque / ficha de item | ✅ | ✅ | ✅ |
| Retirar reagente/material comum | ✅ | ✅ | ✅ |
| Retirar reagente **controlado** | 🟡¹ | 🟡¹ | 🟡¹ |
| Cadastrar/editar item de estoque | ❌ | ✅ | ✅ |
| Definir estoque mínimo | ❌ | ✅ | ✅ |
| Reservar equipamento | 🟡² | ✅ | ✅ |
| Aprovar reserva (quando exigida) | ❌ | ✅ | ✅ |
| Cadastrar/editar equipamento | ❌ | ✅ | ✅ |
| Marcar usuário habilitado / aprovar treinamento | ❌ | ✅ | ✅ |
| Registrar manutenção/calibração | ❌ | ✅ | ✅ |
| Reportar problema em equipamento | ✅ | ✅ | ✅ |
| Triar/aprovar solicitação multiusuário | ❌ | ✅ | ✅ |
| Ver relatórios/custos | ❌ | ✅ | ✅ |
| Gerenciar usuários e permissões | ❌ | ❌ | ✅ |
| Configurar catálogos globais / labs | ❌ | ❌ | ✅ |

¹ **Controlado:** exige autenticação adicional (FR-CTL-2) e papel autorizado; registra cadeia de custódia. Visualização da existência pode ser liberada conforme política.
² **Reserva por Usuário:** condicionada a estar **habilitado** no equipamento (FR-EQP-3) e às regras do equipamento (treinamento obrigatório, aprovação do técnico — FR-AGD-4).

## Regras de autorização (invariantes)

- Toda checagem ocorre no servidor; o cliente apenas esconde/mostra por conveniência.
- O escopo de laboratório é parte da decisão: Técnico do Lab A não gerencia o Lab B.
- Operações críticas (retirada de controlado, alteração de permissões, exclusão/arquivamento) exigem reautenticação/MFA e geram auditoria.
- Papéis são atribuídos e revogados apenas por Administrador, com registro de auditoria.
