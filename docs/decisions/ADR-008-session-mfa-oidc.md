# ADR 008: Ciclo de Sessão Revogável, Autenticação MFA e Integração OIDC Institucional

- **Status:** Aceito
- **Data:** 14/08/2026
- **Autores:** Arqueia Architecture Team (Opus)
- **Decisores:** Time de Segurança e Infraestrutura

---

## 1. Contexto e Problema

O Arqueia necessita de um modelo de identidade robusto para suportar operação em laboratórios multi-institucionais, garantindo:
1. Controle de sessão seguro com revogação instantânea no backend (logout administrativo, troca de senha, revogação por roubo de credencial);
2. Autenticação de dois fatores (MFA) obrigatória para administradores e ações de alto impacto;
3. Integração via OIDC (OpenID Connect) com o provedor institucional sem abrir mão de autenticação local de contingência;
4. Prevenção estrita contra ataques CSRF, hijacking de sessão e vazamento de material criptográfico.

---

## 2. Decisões Congeladas

### 2.1 Ciclo de Sessão e Tokens
- **Access Token:** JWT assinado com HMAC SHA-256 (`HS256`) ou `RS256`, tempo de vida curto (**15 minutos / 900s**). Contém apenas `userId`, `institutionId` e escopo.
- **Refresh Token:** Identificador opaco aleatório de alta entropia (256 bits), armazenado no PostgreSQL com hash SHA-256. Duração de **7 dias**.
- **Rotação de Refresh Token:** Toda renovação invalida o refresh token anterior e emite um novo par. Detecção de reuso invalida imediatamente **todas** as sessões ativas do usuário.
- **Armazenamento de Cookie:** Cookies `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`, escopados ao domínio da aplicação.
- **Limite de Sessões:** Máximo de **5 sessões ativas simultâneas** por usuário. A 6ª sessão invalida a sessão mais antiga.

### 2.2 Autenticação Multifator (MFA)
- **Padrão:** TOTP (Time-based One-Time Password - RFC 6238) via aplicativos autenticadores padrão (Google Authenticator, Bitwarden, FreeOTP).
- **Códigos de Backup:** 8 códigos alfanuméricos de uso único gerados no cadastro de MFA, armazenados no banco como hashes bcrypt/argon2.
- **Obrigatoriedade:** Exigido para papel `ADMIN` e operações sensíveis (atribuição de permissões, desativação de conta, revogação de acessos).

### 2.3 Provedor OIDC Institucional
- Integração alinhada com especificações OpenID Connect Core 1.0.
- Validação estrita no servidor: `issuer`, `audience` (Client ID), `nonce`, `state` (prevenção contra CSRF no handshake OIDC) e assinatura da chave pública JWKS do IdP.
- Mapeamento de atributos confiáveis: `sub` (subject imutável), `email` (deve ser verificado pelo IdP), `name`.

### 2.4 Reautenticação Recente
- Requisito de confirmação com senha ou TOTP para qualquer operação administrativa que modifique memberships, papéis do sistema ou revogação de contas (`confirmationPassword`).

### 2.5 Política de Senhas Locais
- Mínimo de 12 caracteres (conforme OWASP / NIST SP 800-63B).
- Senhas temporárias expiram no primeiro acesso e exigem troca imediata.

---

## 3. Consequências

- **Positivas:**
  - Revogação de sessão em tempo real sem depender apenas da expiração do JWT.
  - Mitigação de Session Hijacking e CSRF via cookies restritivos e tokens opacos rotacionados.
  - Conformidade com padrões institucionais de Single Sign-On (SSO).
- **Negativas / Custos:**
  - Necessidade de consulta ao banco/Redis no endpoint de refresh token para checagem de revogação.
  - Maior complexidade na gestão de estado do fluxo de autenticação e reautenticação.
