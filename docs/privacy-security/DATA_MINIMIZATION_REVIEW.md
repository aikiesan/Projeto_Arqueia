# Revisão de Minimização de Dados (Data Minimization Review)

> **Classificação**: Documento Técnico de Engenharia
> **Princípio Legal**: Art. 6º, III da LGPD (Necessidade / Minimização)
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável pelo Tratamento**: `REQUIRES INSTITUTIONAL VALIDATION`

---

## 1. Princípio da Minimização no Arqueia

O Arqueia foi projetado segundo os princípios de **Privacy by Design** e **Privacy by Default**. A coleta de dados limita-se estritamente ao mínimo indispensável para a identificação institucional do operador, controle de segurança de acesso e prestação de contas do uso de equipamentos públicos e insumos laboratoriais.

---

## 2. Análise de Atributos Coletados vs. Justificativa

| Atributo | Coletado? | Justificativa Técnica / Operacional | Risco de Privacidade |
| :--- | :---: | :--- | :--- |
| **Nome Completo** | Sim | Exibição na interface de agenda para evitar conflitos de uso entre equipes e identificação em relatórios de auditoria. | Baixo |
| **E-mail Institucional** | Sim | Chave única de login, notificações de agendamento e recuperação de credenciais. | Baixo |
| **Vínculo Institucional** | Sim | Restrição de acesso ao ecossistema Unicamp e laboratórios autorizados. | Baixo |
| **Identificador do Orientador** | Sim | Hierarquia de aprovação e governança de projetos de pesquisa multiusuários. | Baixo |
| **Hash de Senha (Argon2id)** | Sim | Autenticação local robusta. Senhas em texto claro **nunca** são armazenadas ou transmitidas em logs. | Baixo (Criptografado) |
| **IP e User-Agent em Sessão** | Sim | Detecção de anomalias de sessão, prevenção de sequestro de sessão e auditoria técnica. | Baixo |

---

## 3. Atributos Rejeitados / Não Coletados (Minimização Efetiva)

| Categoria de Dado | Status no Arqueia | Justificativa da Não Coleta |
| :--- | :---: | :--- |
| **CPF / RG** | **NÃO COLETADO** | Desnecessário para a operação interna; a autenticação institucional via e-mail e vínculo atende plenamente ao propósito sem expor documentos de identificação civil. |
| **Telefone Pessoal / Celular** | **NÃO COLETADO** | Comunicações operacionais ocorrem exclusivamente por e-mail institucional ou avisos no sistema. |
| **Endereço Residencial** | **NÃO COLETADO** | Irrelevante para as operações laboratoriais internas. |
| **Data de Nascimento / Idade** | **NÃO COLETADO** | Irrelevante para a autorização de uso de infraestrutura. |
| **Sexo / Gênero** | **NÃO COLETADO** | Não utilizado para qualquer finalidade no sistema. |
| **Dados Biométricos** | **NÃO COLETADO** | Acesso físico é controlado pelas instalações do prédio; o sistema utiliza apenas credenciais lógicas. |
| **Dados Sensíveis (Art. 5º, II LGPD)** | **NÃO COLETADO** | Origem racial, convicção religiosa, opinião política, filiação sindical ou dados de saúde não têm relação com a finalidade do Arqueia. |
| **Rastreadores / Analytics de Terceiros** | **NÃO COLETADO** | Zero telemetria comercial, zero Google Analytics, zero rastreamento comportamental. |

---

## 4. Avaliação de Necessidade e Proporcionalidade

A auditoria de código confirma que o schema do banco de dados e os contratos de API **não possuem colunas ocultas, campos não documentados ou telemetria em segundo plano**. O nível de coleta atual é estritamente proporcional aos riscos e finalidades da pesquisa acadêmica.
