# Matriz de Retenção e Descarte de Dados (Retention Matrix)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Status dos Prazos Documentais**: `REQUIRES INSTITUTIONAL VALIDATION`
> **Referência Institucional**: Tabela de Temporalidade de Documentos das Atividades-Fim da UNICAMP e Instrução Normativa CGU nº 02/2021.

---

## 1. Distinção entre Prazos Técnicos de Aplicação vs. Prazos Documentais

É imperativo distinguir as configurações técnicas do runtime das aplicações dos prazos documentais institucionais de guarda:

### 1.1. Prazos Técnicos de Aplicação (Configurados no Código)
| Mecanismo Técnico | Parâmetro / Tabela | Duração / Expiração | Justificativa de Engenharia |
| :--- | :--- | :--- | :--- |
| **Token de Acesso JWT** | `JWT_ACCESS_TTL_SECONDS` | 15 minutos (900s) | Minimização da janela de exposição em caso de interceptação de token. |
| **Bloqueio por Força Bruta** | `local_credentials.locked_until` | 15 minutos (900s) | Mitigação de ataques de força bruta contra senhas. |
| **Janela de Rate Limiting** | `AuthRateLimiterService` | 60 segundos (10 requisições) | Proteção dos endpoints sensíveis de autenticação. |
| **Sessões Inativas / Revogadas** | `auth_sessions` | 30 dias após revogação/expiração | Limpeza periódica de tokens expirados e manutenção de banco. |

### 1.2. Prazos Documentais Institucionais (Submetidos à Validação da UNICAMP)
| Categoria de Dado | Tabelas Afetadas | Prazo Documental Proposto | Justificativa / Fundamentação | Status Institucional |
| :--- | :--- | :--- | :--- | :---: |
| **Cadastro de Usuários Inativos** | `users`, `memberships` | *A determinar pela UNICAMP* | Histórico de autoria em pesquisas e vínculo acadêmico | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Registros de Uso de Equipamentos** | `equipment_occupations`, `reservations` | *A determinar pela UNICAMP* | Requisitos operacionais e prestação de contas de projetos | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Movimentações de Estoque / Reagentes** | `stock_movements`, `batches` | *A determinar pela UNICAMP* | Controle patrimonial, fomento e eventual material controlado | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Trilha de Auditoria do Sistema** | `audit_events` | *A determinar pela UNICAMP* | Segurança, accountability e Tabela de Temporalidade institucional | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Documentos e POPs Versionados** | `documents` | *A determinar pela UNICAMP* | Ciclo de vida do equipamento e metodologia de pesquisa | `REQUIRES INSTITUTIONAL VALIDATION` |

---

## 2. Ações de Governança Necessárias

1. **Consulta à Tabela de Temporalidade da UNICAMP**: Submeter o rol de dados operacionais ao Arquivo Central (SIARQ) e ao Escritório de Privacidade da UNICAMP para validação dos prazos formais de descarte e arquivamento permanente.
2. **Rotinas de Expurgo Automático**: A implementação de rotinas automáticas de deleção lógica ou física no `@arqueia/worker` seguirá estritamente a deliberação formal homologada pelo DPO institucional.
