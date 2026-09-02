# Inventário de Dados Pessoais (Data Inventory)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável pelo Tratamento**: `REQUIRES INSTITUTIONAL VALIDATION`
> **Escopo**: Mapeamento exaustivo de campos e tabelas com dados pessoais no banco de dados do Arqueia.

---

## 1. Mapeamento de Tabelas e Atributos Pessoais

| Tabela | Coluna / Campo | Tipo de Dado | Classificação LGPD | Finalidade Operacional | Hipótese Legal Candidata / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `id` | UUID | Identificador Técnico | Chave primária única da conta do usuário | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `name` | VARCHAR(120) | Dado Pessoal Cadastral | Identificação do pesquisador/operador na interface e relatórios | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `email` | VARCHAR(254) | Dado Pessoal / Contato | Identificador de login institucional e comunicações do sistema | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `institution_id` | UUID | Dado Institucional | Vínculo com a instituição (Unicamp) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `supervisor_user_id` | UUID (nullable) | Vínculo Acadêmico | Associação com docente/pesquisador responsável | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `status` | ENUM | Dado Operacional | Controle de ciclo de vida (`INVITED`, `ACTIVE`, `SUSPENDED`) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `users` | `identity_provider` | ENUM | Dado Técnico | Origem da autenticação (`LOCAL`, `OIDC`, `HYBRID`) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `local_credentials` | `password_hash` | TEXT | Dado Técnico de Segurança | Hashing seguro de senha com Argon2id | `REQUIRES INSTITUTIONAL VALIDATION` |
| `local_credentials` | `password_changed_at` | TIMESTAMPTZ | Dado Técnico de Segurança | Controle de validade e rotação de credenciais | `REQUIRES INSTITUTIONAL VALIDATION` |
| `local_credentials` | `failed_attempts` | INTEGER | Dado Técnico de Segurança | Mitigação de ataques de força bruta | `REQUIRES INSTITUTIONAL VALIDATION` |
| `local_credentials` | `locked_until` | TIMESTAMPTZ (nullable) | Dado Técnico de Segurança | Bloqueio temporário de conta após falhas consecutivas | `REQUIRES INSTITUTIONAL VALIDATION` |
| `memberships` | `user_id`, `laboratory_id`, `role` | UUID, UUID, ENUM | Dado Operacional / RBAC | Escopo de permissões por laboratório (`USUARIO`, `TECNICO`, `RESPONSAVEL_CONTROLADOS`) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `system_role_assignments` | `user_id`, `role` | UUID, ENUM | Dado Operacional / RBAC | Atribuição de perfil administrativo do sistema (`ADMIN`) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `auth_sessions` | `user_id`, `refresh_token_hash` | UUID, TEXT | Dado Técnico de Sessão | Gerenciamento de sessões ativas | `REQUIRES INSTITUTIONAL VALIDATION` |
| `auth_sessions` | `ip_address`, `user_agent` | INET, VARCHAR(512) | Dado Técnico de Segurança | Rastreamento de origem para detecção de anomalias | `REQUIRES INSTITUTIONAL VALIDATION` |
| `reservations` | `user_id`, `cancelled_by_user_id` | UUID, UUID (nullable) | Dado Operacional de Uso | Autoria de agendamento e cancelamento de equipamento | `REQUIRES INSTITUTIONAL VALIDATION` |
| `reservations` | `purpose`, `notes` | VARCHAR(500), VARCHAR(2000) | Dado de Pesquisa Operacional | Justificativa do uso de equipamento multiusuário | `REQUIRES INSTITUTIONAL VALIDATION` |
| `stock_movements` | `user_id` | UUID | Rastreabilidade de Custódia | Identificação do responsável pela retirada ou ajuste de reagentes | `REQUIRES INSTITUTIONAL VALIDATION` |
| `stock_movements` | `purpose`, `reason` | VARCHAR(255), VARCHAR(255) | Dado de Pesquisa Operacional | Justificativa de consumo de insumo e prestação de contas | `REQUIRES INSTITUTIONAL VALIDATION` |
| `audit_events` | `actor_id` | UUID (nullable) | Trilha de Auditoria | Identificação do autor de ações sensíveis (criação, edição, login) | `REQUIRES INSTITUTIONAL VALIDATION` |
| `documents` | `author_id` | UUID | Autoria Operacional | Rastreabilidade de autoria de Procedimentos Operacionais Padrão | `REQUIRES INSTITUTIONAL VALIDATION` |

---

## 2. Categorias de Titulares dos Dados

1. **Pesquisadores e Docentes da UNICAMP**: Responsáveis por projetos de pesquisa e orientação acadêmica.
2. **Alunos de Graduação e Pós-Graduação / Pós-Doutorandos**: Usuários operadores de equipamentos e consumidores de reagentes.
3. **Técnicos de Laboratório Especializados**: Gestores operacionais de equipamentos, bloqueios técnicos e estoque.
4. **Administradores do Sistema**: Responsáveis pela gestão de usuários e governança global da plataforma.
5. **Usuários Externos Autorizados (Convênios/Multiusuários)**: Pesquisadores externos formalmente vinculados a projetos de pesquisa aprovados.
