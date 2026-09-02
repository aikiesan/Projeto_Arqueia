# Matriz de Controle de Acesso Baseado em Papéis (RBAC Matrix)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Fonte da Verdade**: `packages/contracts/src/identity/permissions.ts` e `PermissionEvaluator`

---

## 1. Estrutura de Papéis e Escopos

O Arqueia implementa autorização baseada na tupla **(Usuário, Papel, Laboratório)** com dois níveis de escopo:
1. **Escopo de Sistema (`SYSTEM`)**: Perfil `ADMIN` com abrangência global sobre instituições, laboratórios e usuários.
2. **Escopo de Laboratório (`LABORATORY`)**: Perfis vinculados exclusivamente a um laboratório específico (`USUARIO`, `TECNICO`, `RESPONSAVEL_CONTROLADOS`).

---

## 2. Matriz de Permissões por Papel

| Permissão do Sistema | Descrição Operacional | USUARIO (Lab) | TECNICO (Lab) | RESPONSAVEL_CONTROLADOS (Lab) | ADMIN (Sistema) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `identity.user.read` | Listar usuários do laboratório/instituição | ❌ | ✅ | ❌ | ✅ |
| `identity.user.manage` | Criar, suspender ou arquivar usuários | ❌ | ❌ | ❌ | ✅ |
| `identity.laboratory.read` | Visualizar dados do laboratório | ✅ | ✅ | ✅ | ✅ |
| `identity.laboratory.manage` | Criar e editar dados de laboratórios | ❌ | ❌ | ❌ | ✅ |
| `identity.project.read` | Visualizar projetos vinculados ao lab | ✅ | ✅ | ✅ | ✅ |
| `identity.project.manage` | Criar e editar projetos no laboratório | ❌ | ✅ | ❌ | ✅ |
| `identity.membership.manage` | Atribuir ou revogar papéis de usuários no lab | ❌ | ❌ | ❌ | ✅ |
| `inventory.read` | Consultar catálogo de produtos e lotes | ✅ | ✅ | ✅ | ✅ |
| `inventory.withdraw` | Realizar saída/consumo de insumo comum | ✅ | ✅ | ❌ | ✅ |
| `inventory.manage` | Cadastrar produtos, lotes e ajustes de saldo | ❌ | ✅ | ❌ | ✅ |
| `equipment.read` | Consultar catálogo e estado de equipamentos | ✅ | ✅ | ❌ | ✅ |
| `equipment.report-incident` | Registrar ocorrências/falhas em equipamento | ✅ | ✅ | ❌ | ✅ |
| `equipment.manage` | Cadastrar equipamentos e regras de uso | ❌ | ✅ | ❌ | ✅ |
| `scheduling.reserve` | Criar e gerenciar suas próprias reservas | ✅ | ✅ | ❌ | ✅ |
| `scheduling.cancel` | Cancelar reservas próprias (ou de terceiros para técnicos) | ✅ (Próprias) | ✅ (Todas do lab) | ❌ | ✅ |
| `scheduling.approve` | Aprovar reservas que requerem autorização | ❌ | ✅ | ❌ | ✅ |
| `scheduling.block.manage` | Criar bloqueios técnicos/manutenções na agenda | ❌ | ✅ | ❌ | ✅ |
| `controlled.authorize` | Autorizar custódia/retirada de produto controlado | ❌ | ❌ | ✅ | ✅ |
| `management.report.read` | Acessar relatórios gerenciais e dashboards do lab | ❌ | ✅ | ❌ | ✅ |
| `audit.read` | Consultar trilha de auditoria imutável do lab | ❌ | ✅ | ❌ | ✅ |

---

## 3. Invariantes de Segurança da Autorização

1. **Avaliação Estritamente no Servidor**: O frontend Next.js apenas adapta a visualização de acordo com o papel; o backend NestJS (`PermissionEvaluator.assertCan`) valida a permissão e o laboratório em cada caso de uso.
2. **Isolamento de Tenant (Cross-Lab Deny)**: Um usuário com papel `TECNICO` no Laboratório A não possui qualquer permissão no Laboratório B, a menos que possua um vínculo explícito e ativo no Laboratório B.
3. **Usuários Arquivados/Suspensos**: Qualquer status diferente de `ACTIVE` ou `archived_at IS NOT NULL` revoga imediatamente todas as permissões em tempo real, sem necessidade de expiração de cache.
