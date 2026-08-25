# Avaliação de Impacto e Scaffolding de Substâncias Controladas (Future Controlled Substances Impact)

> **Classificação**: Documento Técnico e Prospectivo de Privacidade
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Status**: Scaffolding Arquitetural Presente no Código / Operação Futura Planejada

---

## 1. Distinção entre Estado Atual (Scaffolding) vs. Operação Futura

É fundamental distinguir com clareza o que já existe implementado como infraestrutura no código-fonte do que constitui operação futura:

### 1.1. Estado Atual no Código-Fonte (`Scaffolding` Concluído)
- **Papel RBAC**: Papel `RESPONSAVEL_CONTROLADOS` delimitado no contrato de permissões (`packages/contracts/src/identity/roles.ts`).
- **Permissão de Domínio**: `controlled.authorize` definida no catálogo de permissões (`packages/contracts/src/identity/permissions.ts`).
- **Schema de Catálogo**: Flag `isControlled: boolean` no schema de produtos e regras de inventário.
- **Serviço de Reautenticação**: `ReauthenticationService` implementado para exigir verificação de senha antes de atribuições sensíveis.

### 1.2. Operação Futura Planejada (Fase 4 do Roadmap)
- Módulo operacional dedicado para registro de cadeia de custódia de reagentes controlados por órgãos reguladores externos (Polícia Federal, Exército Brasileiro, ANVISA).
- Fluxo de autorização em duas etapas (*dual authorization*) no momento da retirada física de insumos restritos.
- Emissão de relatórios e mapas periódicos de consumo para órgãos fiscalizadores.

---

## 2. Impactos de Privacidade e Proteção de Dados na Operação Futura

Quando o módulo de substâncias controladas for ativado em produção:

1. **Hipótese Legal Específica**:
   - A base legal para registro da cadeia de custódia e identificação de quem retirou e quem autorizou o reagente será estritamente o **Art. 7º, II da LGPD (Cumprimento de obrigação legal ou regulatória)**, decorrente das Portarias da Polícia Federal (ex.: Portaria MJSP nº 240/2019) e regulamentos do Exército.
2. **Minimização e Identificação**:
   - Manter a regra de não coletar CPF na plataforma, a menos que uma portaria federal expressamente exija o número de CPF no mapa de controle (caso em que a base legal específica e o consentimento/dever legal suprirão a exigência).
3. **Dupla Custódia e Auditoria Reforçada**:
   - Toda retirada de reagente controlado exigirá o registro conjunto do pesquisador requisitante e do `RESPONSAVEL_CONTROLADOS`, gerando evento de auditoria imutável com ambos os identificadores institucionais.
4. **Atualização Prévia do RIPD**:
   - Antes do go-live da operação de substâncias controladas, o presente RIPD deverá ser atualizado e ressubmetido ao Escritório de Privacidade da UNICAMP para registrar os novos fluxos de prestação de contas aos órgãos fiscalizadores.
