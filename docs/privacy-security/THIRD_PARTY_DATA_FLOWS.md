# Fluxo de Compartilhamento com Terceiros (Third-Party Data Flows)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Conclusão Técnica**: Zero telemetria de terceiros comerciais na aplicação.

---

## 1. Mapeamento de Terceiros e Operadores

| Entidade / Serviço | Papel / Função | Dados Compartilhados | Finalidade | Localização Geográfica |
| :--- | :--- | :--- | :--- | :--- |
| **Infraestrutura Unicamp (CP2b / CCUEC)** | Hospedagem / Operador Interno | Base de dados do Arqueia | Execução dos serviços em servidores institucionais da Unicamp. | Campinas/SP, Brasil (Servidores Próprios) |
| **IdP Unicamp (SSO Institucional)** *(Futuro / Scaffolding)* | Provedor de Identidade | E-mail institucional e identificador de usuário Unicamp | Autenticação única de docentes, alunos e funcionários. | Campinas/SP, Brasil (Unicamp) |
| **Serviço de E-mail Institucional (SMTP Unicamp)** | Notificações do Sistema | Nome e e-mail do destinatário | Envio de avisos de reserva, cancelamento e redefinição de senha. | Campinas/SP, Brasil (Unicamp) |

---

## 2. Terceiros Não Utilizados (Zero Rastreamento Externo)

- **Plataformas de Analytics (Google Analytics, Mixpanel, Amplitude)**: **NÃO UTILIZADO**.
- **Gerenciadores de Tags (Google Tag Manager)**: **NÃO UTILIZADO**.
- **Ferramentas de Monitoramento de Sessão (Hotjar, FullStory)**: **NÃO UTILIZADO**.
- **Redes Sociais / Widgets de Terceiros (Facebook, LinkedIn, X)**: **NÃO UTILIZADO**.
- **Provedores de Nuvem Pública Comercial com Transferência Internacional**: **NÃO UTILIZADO** no escopo da aplicação.

---

## 3. Transferência Internacional de Dados (Art. 33 LGPD)

- **Escopo de Aplicação**: Nenhum fluxo internacional de dados pessoais foi identificado na arquitetura atual do software.
- **Infraestrutura de Produção**: Planejada para residir em servidores próprios e rede institucional da UNICAMP em território brasileiro.
- **Status Institucional**: `READY BUT REQUIRES DEPLOYMENT / INSTITUTIONAL CONFIRMATION` (a ser ratificado formalmente na verificação do ambiente físico de produção, procedimentos de backup externo e serviços institucionais integrados).
