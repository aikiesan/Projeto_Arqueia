# Inventário de Cookies e Armazenamento Local (Cookie Inventory)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Conclusão Técnica**: Aplicação 100% livre de cookies de rastreamento, marketing ou terceiros.

---

## 1. Mapeamento de Cookies Utilizados

O Arqueia utiliza **exclusivamente cookies estritamente necessários** para o funcionamento da autenticação e controle de sessão do usuário:

| Nome do Cookie | Origem / Emissor | Finalidade | Tipo / Duração | Atributos de Segurança |
| :--- | :--- | :--- | :--- | :--- |
| `arqueia_session` | BFF (`apps/web`) | Armazena o token JWT de autenticação para comunicação autorizada com a API. | Estritamente Necessário / Sessão ou 15 min | `HttpOnly: true`<br>`Secure: true` (em produção)<br>`SameSite: Strict`<br>`Path: /`<br>`Priority: High` |

---

## 2. Cookies de Terceiros e Rastreamento

- **Cookies de Terceiros**: **ZERO**. Não são emitidos cookies de domínio externo.
- **Cookies de Marketing / Publicidade**: **ZERO**.
- **Cookies de Analytics / Telemetria**: **ZERO**.
- **Pixels de Rastreamento / Web Beacons**: **ZERO**.

---

## 3. Armazenamento Local no Navegador (LocalStorage / SessionStorage)

| Chave de Armazenamento | Tipo de Storage | Finalidade | Contém Dado Pessoal? |
| :--- | :--- | :--- | :---: |
| `theme` / Preferência de UI | LocalStorage | Armazena preferência cosmética de tema claro/escuro. | Não |
| Filtros de Visualização da Agenda | SessionStorage | Mantém o estado temporário do laboratório selecionado durante a navegação. | Não |

---

## 4. Conformidade e Dispensabilidade de Banner de Cookies

Conforme orientação da Autoridade Nacional de Proteção de Dados (ANPD) e do Escritório de Privacidade da UNICAMP, **cookies estritamente necessários para o funcionamento e segurança do serviço não exigem consentimento prévio ou banner obstrutivo de cookies**. A sua utilização encontra-se devidamente informada no Aviso de Privacidade do sistema.
