# Checklist de Submissão para Registro no Sistema Privacidade UNICAMP

> **Classificação**: Guia Operacional de Submissão Institucional
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Encarregado (DPO)**: Prof. Dr. José Luiz da Costa (`lgpd@unicamp.br`)
> **Escritório de Privacidade**: `privacidade@unicamp.br` | [Portal de Privacidade UNICAMP](https://www.privacidade.unicamp.br/escritorio/controlador-e-encarregado/)
> **Destinatário**: Equipe de Governança e Gestores Institucionais da Plataforma Arqueia

---

## 1. RIPD Working Field Completeness Table

Campos preparados a partir das exigências normativas da LGPD, Instruções Normativas da UNICAMP e informações técnicas atualmente disponíveis no repositório. A estrutura final deve ser conferida no Sistema Privacidade da UNICAMP durante o cadastramento:

| Item / Campo de Registro | Evidência Produzida no Arqueia | Localização no Repositório | Status de Prontidão |
| :--- | :--- | :--- | :--- |
| **Identificação do Controlador** | UNICAMP (CNPJ 46.068.425/0001-33) | `docs/privacy/RIPD_ARQUEIA_DRAFT.md` | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Encarregado pelo Tratamento (DPO)** | Prof. Dr. José Luiz da Costa (`lgpd@unicamp.br`) | `docs/privacy/RIPD_ARQUEIA_DRAFT.md` | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Contato do Escritório de Privacidade** | `privacidade@unicamp.br` | `docs/privacy/ARQUEIA_PRIVACY_NOTICE.md` | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Unidade / Órgão Gestor do Tratamento** | A ser formalizado pela gestão da UNICAMP | `docs/privacy/RIPD_ARQUEIA_DRAFT.md` | `REQUIRES INSTITUTIONAL INPUT` |
| **Responsável Institucional / Coordenador** | A designar formalmente | `docs/privacy/RIPD_ARQUEIA_DRAFT.md` | `REQUIRES INSTITUTIONAL INPUT` |
| **Nome e Finalidade do Sistema** | Arqueia — Gestão de Infraestrutura Multiusuário | `docs/privacy/ARQUEIA_PRIVACY_NOTICE.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Inventário Exaustivo de Dados Pessoais** | Mapeamento de tabelas e atributos coletados | `docs/privacy-security/DATA_INVENTORY.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Minimização de Dados (Dados Não Coletados)** | Rejeição de CPF, RG, telefones, telemetria | `docs/privacy-security/DATA_MINIMIZATION_REVIEW.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Categorias de Titulares dos Dados** | Pesquisadores, alunos, técnicos e gestores | `docs/privacy-security/DATA_INVENTORY.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Matriz de Hipóteses Legais Candidatas** | Matriz com bases propostas para validação | `docs/privacy/LGPD_COMPLIANCE_MATRIX.md` | `REQUIRES INSTITUTIONAL INPUT` |
| **Prazos Documentais de Retenção e Descarte** | Propostas a alinhar com Tabela de Temporalidade | `docs/privacy-security/RETENTION_MATRIX.md` | `REQUIRES INSTITUTIONAL INPUT` |
| **Compartilhamento com Terceiros** | Zero terceiros comerciais / sem compartilhamento | `docs/privacy-security/THIRD_PARTY_DATA_FLOWS.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Transferência Internacional de Dados** | Nenhum fluxo internacional identificado na arquitetura | `docs/privacy-security/THIRD_PARTY_DATA_FLOWS.md` | `READY BUT REQUIRES DEPLOYMENT / INSTITUTIONAL CONFIRMATION` |
| **Inventário de Cookies e Armazenamento** | Apenas cookie estritamente necessário | `docs/privacy-security/COOKIE_INVENTORY.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Medidas de Segurança da Informação** | Criptografia Argon2id, TLS, lockout, RBAC | `docs/privacy-security/CURRENT_STATE_ASSESSMENT.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Plano de Resposta a Incidentes** | Runbook com comunicação direta ao DPO | `docs/security/INCIDENT_RESPONSE_RUNBOOK.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Procedimento de Direitos dos Titulares** | Runbook para requisições do Art. 18 LGPD | `docs/privacy/DATA_SUBJECT_REQUEST_RUNBOOK.md` | `READY FROM TECHNICAL EVIDENCE` |
| **Minuta Consolidada do RIPD** | Documento estruturado para preenchimento | `docs/privacy/RIPD_ARQUEIA_DRAFT.md` | `READY FROM TECHNICAL EVIDENCE` |

---

## 2. Passo a Passo para Validação de Infraestrutura e Submissão Institucional

1. **Validação Operacional na VM de Produção**:
   - Executar os 18 testes de aceitação listados em `docs/deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md` para assegurar o correto isolamento de rede, normalização de headers e terminação HTTPS/TLS.
2. **Definição da Unidade/Órgão Responsável**:
   - Confirmar formalmente a Unidade/Órgão Gestor e o docente/servidor coordenador responsável pela operação do Arqueia.
3. **Abertura do Processo no Sistema Privacidade da UNICAMP**:
   - Utilizar o Sistema Privacidade oficial da UNICAMP para cadastrar a atividade de tratamento e submeter o RIPD e Plano de Ação.
4. **Validação Institucional das Hipóteses Legais e Temporalidade**:
   - Submeter a matriz de bases legais e a matriz de retenção ao Escritório de Privacidade (`privacidade@unicamp.br`) e ao DPO (`lgpd@unicamp.br`).
5. **Registro e Homologação**:
   - Obter o número de registro do tratamento aprovado pelo DPO institucional.
