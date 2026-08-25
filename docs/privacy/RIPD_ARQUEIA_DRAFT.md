# Minuta do Relatório de Impacto à Proteção de Dados Pessoais (RIPD / DPIA)

> **Documento Institucional**: Relatório de Impacto à Proteção de Dados Pessoais — Plataforma Arqueia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável pelo Tratamento**: `REQUIRES INSTITUTIONAL VALIDATION`
> **Encarregado pelo Tratamento de Dados Pessoais (DPO)**: Prof. Dr. José Luiz da Costa (`lgpd@unicamp.br`)
> **Escritório de Privacidade UNICAMP**: `privacidade@unicamp.br` | [Portal Oficial](https://www.privacidade.unicamp.br/escritorio/controlador-e-encarregado/)
> **Status**: `TECHNICALLY PREPARED FOR INSTITUTIONAL LGPD/RIPD REVIEW`

---

## 1. Identificação do Controlador e do Projeto

| Campo do Registro | Informação Institucional / Técnica | Status de Prontidão |
| :--- | :--- | :--- |
| **Nome da Instituição Controladora** | Universidade Estadual de Campinas — UNICAMP | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **CNPJ do Controlador** | 46.068.425/0001-33 | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Encarregado (DPO)** | Prof. Dr. José Luiz da Costa (`lgpd@unicamp.br`) | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Contato do Escritório de Privacidade** | `privacidade@unicamp.br` | `READY FROM OFFICIAL INSTITUTIONAL SOURCE` |
| **Nome do Sistema / Processo** | Arqueia — Gestão Integrada de Infraestrutura Laboratorial e Multiusuários | `READY FROM TECHNICAL EVIDENCE` |
| **Unidade / Órgão Gestor** | `REQUIRES INSTITUTIONAL VALIDATION` (A definir formalmente pela UNICAMP) | `REQUIRES INSTITUTIONAL INPUT` |
| **Responsável Técnico / Institucional** | Docente / Coordenador formalmente designado | `REQUIRES INSTITUTIONAL INPUT` |

---

## 2. Descrição da Operação de Tratamento e Necessidade

- **Contexto**: A UNICAMP opera laboratórios multiusuários de pesquisa científica equipados com instrumentos avançados (cromatógrafos, espectrômetros, reatores) e reagentes de alto valor/controle.
- **Necessidade do Tratamento**:
  - Organizar a agenda de uso compartilhado e evitar sobreposições em equipamentos de alta demanda.
  - Garantir a rastreabilidade e prestação de contas do uso de insumos e infraestrutura pública financiada por auxílios à pesquisa.
  - Assegurar a integridade e segurança do ambiente laboratorial universitário.
- **Minimização Comprovada**:
  - Coletam-se apenas: Nome, E-mail Institucional, Vínculo com Projeto/Orientador e Credencial Criptografada (Argon2id).
  - **Não** são tratados dados sensíveis (Art. 5º, II da LGPD), dados biométricos, CPF, RG, endereços ou dados de geolocalização.

---

## 3. Matriz de Hipóteses Legais Candidatas (Art. 7º LGPD)

| Atividade de Tratamento | Finalidade | Hipótese Legal Candidata | Justificativa Operacional | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Cadastro de Usuário Autorizado** | Gestão de identidade e vínculo | A determinar institucionalmente | Processo institucional de admissão em laboratório | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Vínculos de Acesso (Membership / RBAC)** | Controle de autorização por laboratório | A determinar institucionalmente | Necessidade de segregação de acesso | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Agendamento e Uso de Equipamentos** | Gestão e fila de uso multiusuário | A determinar institucionalmente | Otimização de infraestrutura pública de pesquisa | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Movimentação de Estoque / Reagentes** | Controle e custódia de insumos | A determinar institucionalmente | Rastreabilidade e prestação de contas | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Trilha de Auditoria e Logs do Sistema** | Segurança e accountability | A determinar institucionalmente | Integridade, rastreabilidade forense e conformidade | `REQUIRES INSTITUTIONAL VALIDATION` |

> **Nota Epistemológica**: As hipóteses jurídicas acima constituem subsídios de engenharia e devem ser formalmente ratificadas pelo Escritório de Privacidade / Procuradoria da UNICAMP. O Art. 7º, IX da LGPD refere-se a **Legítimo Interesse** (e não à "Segurança" como denominação de base legal).

---

## 4. Retenção e Ciclo de Vida dos Dados

- **Prazos Técnicos de Aplicação**:
  - Tokens de Acesso JWT: 15 minutos (`JWT_ACCESS_TTL_SECONDS=900`).
  - Bloqueio por Força Bruta: 15 minutos (`AUTH_LOCKOUT_DURATION_SECONDS=900`).
  - Janela de Rate Limiting: 60 segundos (`AUTH_RATE_LIMIT_WINDOW_SECONDS=60`).
- **Prazos Documentais de Retenção**:
  - Reservas de equipamentos: `REQUIRES INSTITUTIONAL VALIDATION` (justificativa: requisitos operacionais e histórico de pesquisa a serem determinados).
  - Trilha de auditoria: `REQUIRES INSTITUTIONAL VALIDATION` (justificativa: requisitos de segurança/accountability e Tabela de Temporalidade da UNICAMP a serem confirmados).
  - Movimentações de estoque: `REQUIRES INSTITUTIONAL VALIDATION` (justificativa: sujeitas a regras administrativas, de fomento à pesquisa ou de materiais controlados).

---

## 5. Medidas Técnicas e Administrativas de Salvaguarda

1. **Criptografia e Hashing**: Senhas armazenadas com Argon2id ($m=19456\text{ KB}$, $t=2$, $p=1$, len=32) e tráfego com HTTPS/TLS obrigatório na fronteira pública.
2. **Controle de Acesso Fino (RBAC Papel × Lab)**: Isolamento estrito entre laboratórios e usuários; permissões validadas no backend em cada caso de uso.
3. **Proteção contra Força Bruta**: Rate limiting em camada de aplicação e bloqueio atômico de contas após 5 falhas consecutivas (`locked_until`).
4. **Trilha de Auditoria Imutável**: Tabela `audit_events` append-only via triggers PL/pgSQL com sanitização automática de segredos.
5. **Isolamento de Rede**: Portas de banco e backend escutando estritamente em `127.0.0.1` na VM Debian em produção.
6. **Ausência de Rastreamento**: Zero telemetria de terceiros, zero analytics externo, zero cookies de publicidade.

---

## 6. Parecer Técnico e Conclusão

Com a conclusão do hardening de segurança, validação de testes automatizados reais (348 testes verdes) e documentação de evidências, a plataforma Arqueia encontra-se:

**`TECHNICALLY PREPARED FOR INSTITUTIONAL LGPD/RIPD REVIEW`**

O sistema atende plenamente aos requisitos de engenharia de privacidade e segurança por design. Os próximos passos são predominantemente institucionais, com validação final da infraestrutura na VM de produção e homologação formal junto ao Escritório de Privacidade da UNICAMP.
