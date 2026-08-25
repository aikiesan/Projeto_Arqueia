# Matriz de Conformidade e Hipóteses Legais LGPD (LGPD Compliance Matrix)

> **Classificação**: Documento Técnico e de Mapeamento Jurídico-Institucional
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável**: `REQUIRES INSTITUTIONAL VALIDATION`
> **Status das Bases Legais**: `PROPOSED / REQUIRES INSTITUTIONAL VALIDATION`

---

## 1. Mapeamento de Atividades de Tratamento vs. Hipótese Legal Candidata (Art. 7º LGPD)

| Atividade de Tratamento | Finalidade Operacional | Hipótese Legal Candidata (Art. 7º LGPD) | Justificativa Operacional | Status Institucional |
| :--- | :--- | :--- | :--- | :---: |
| **Cadastro de Usuário Autorizado** | Gestão de identidade e vínculo | *A determinar formalmente* (Candidatas: Art. 7º, III / IX) | Processo institucional de admissão em laboratório e controle de contas | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Vínculos de Acesso (Membership / RBAC)** | Controle de autorização por laboratório | *A determinar formalmente* (Candidatas: Art. 7º, III / IX) | Segregação de privilégios de acesso e segurança da informação | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Agendamento de Equipamentos** | Gestão e fila de uso multiusuário | *A determinar formalmente* (Candidata: Art. 7º, III) | Otimização de infraestrutura pública e apoio a pesquisas científicas | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Movimentação de Estoque / Reagentes** | Controle e custódia de insumos | *A determinar formalmente* (Candidatas: Art. 7º, II / III) | Rastreabilidade e prestação de contas de projetos de pesquisa | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Trilha de Auditoria e Logs do Sistema** | Segurança e accountability | *A determinar formalmente* (Candidatas: Art. 7º, II / IX) | Proteção lógica, integridade e rastreabilidade forense | `REQUIRES INSTITUTIONAL VALIDATION` |
| **Versionamento de Documentos / POPs** | Rastreabilidade de protocolos | *A determinar formalmente* (Candidata: Art. 7º, III) | Histórico de metodologia científica em laboratório | `REQUIRES INSTITUTIONAL VALIDATION` |

---

## 2. Esclarecimento Jurídico sobre as Hipóteses Legais da LGPD

1. **Art. 7º, Inciso II (Cumprimento de Obrigação Legal ou Regulatória)**: Aplicável quando houver norma legal, portaria regulatória ou dever formal de custódia e prestação de contas (ex.: auditoria pública, controle de reagentes).
2. **Art. 7º, Inciso III (Execução de Políticas Públicas / Ensino e Pesquisa)**: Trata da realização de estudos por órgão de pesquisa ou execução de atividades da administração pública respaldadas em instrumentos jurídicos institucionais.
3. **Art. 7º, Inciso IX (Legítimo Interesse do Controlador ou de Terceiro)**: Hipótese jurídica para atendimento de interesses legítimos, respeitados os direitos e liberdades fundamentais do titular. Segurança e proteção contra fraudes atuam como finalidades operacionais e justificativas de salvaguarda, não sendo o nome da hipótese legal.

---

## 3. Princípios da LGPD Aplicados ao Arqueia (Art. 6º)

1. **Finalidade (Inciso I)**: Coleta restrita à gestão da infraestrutura científica e prestação de contas.
2. **Adequação (Inciso II)**: Tratamento compatível com o contexto de laboratórios multiusuários acadêmicos.
3. **Necessidade / Minimização (Inciso III)**: Rejeição de CPF, RG, telefones pessoais, endereços e telemetria comercial.
4. **Livre Acesso (Inciso IV)**: Consulta facilitada aos dados de perfil, agendamentos e registros pelo titular.
5. **Qualidade dos Dados (Inciso V)**: Garantia de exatidão e atualização cadastral via interface do sistema.
6. **Transparência (Inciso VI)**: Aviso de Privacidade claro e canais do DPO explicitados.
7. **Segurança (Inciso VII)**: Hashing Argon2id, HTTPS/TLS, isolamento de rede loopback, triggers de imutabilidade, rate limiting e lockout.
8. **Prevenção (Inciso VIII)**: Medidas preventivas contra ataques de força bruta e vazamentos de credenciais.
9. **Não Discriminação (Inciso IX)**: Ausência de decisões automatizadas discriminatórias ou tratamento de dados sensíveis.
10. **Responsabilização (Inciso X)**: Trilha de auditoria append-only, relatórios de validação técnica e subsídios para o RIPD.
