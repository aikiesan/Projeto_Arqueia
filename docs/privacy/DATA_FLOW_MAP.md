# Mapeamento do Fluxo de Dados Pessoais (Data Flow Map)

> **Classificação**: Documento Técnico e de Privacidade
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável**: `REQUIRES INSTITUTIONAL VALIDATION`

---

## 1. Diagrama de Fluxo de Dados Ponta a Ponta

```mermaid
sequenceDiagram
    autonumber
    actor User as Pesquisador / Operador
    participant Proxy as Proxy HTTPS Unicamp
    participant Apache as Apache2 da VM (:80)
    participant Web as Next.js BFF (:4002)
    participant API as NestJS API (:4001)
    participant DB as PostgreSQL (:5432)
    participant Redis as Redis (:6379)
    participant Audit as Trilha de Auditoria Imutável

    User->>Proxy: 1. Acesso HTTPS (cp2b.unicamp.br/arqueia)
    Proxy->>Apache: 2. Tráfego institucional para a VM
    Apache->>Web: 3. Proxy /arqueia (127.0.0.1:4002)
    User->>Web: 4. Submissão de login (email + senha)
    Web->>API: 5. POST /api/auth/login (Origin + X-Forwarded-For)
    API->>API: 5. AuthRateLimitGuard (Verificação por IP do cliente)
    API->>DB: 6. Consulta usuário + credencial Argon2id
    API->>API: 7. Verificação de senha + verificação de lockout
    alt Falha de Autenticação
        API->>DB: 8a. Incremento atômico de failed_attempts / locked_until
        API->>Audit: 8b. Append identity.login.failed (sanitizado)
        API-->>Web: 8c. 401 Unauthorized (InvalidCredentialsError)
    else Sucesso de Autenticação
        API->>DB: 9a. Reset failed_attempts = 0, locked_until = NULL
        API->>Audit: 9b. Append identity.login.succeeded
        API-->>Web: 9c. Retorno de JWT de curta duração
        Web-->>User: 9d. Set-Cookie arqueia_session (HttpOnly, SameSite=Strict)
    end

    User->>Web: 10. Ação Operacional (ex: Reserva de Equipamento)
    Web->>API: 11. POST /api/scheduling (Bearer JWT)
    API->>API: 12. PermissionEvaluator (Papel × Laboratório)
    API->>DB: 13. Transação SQL + Exclusion Constraint Concorrência
    API->>Audit: 14. Append scheduling.reservation.created (Before/After)
    API-->>Web: 15. 201 Created (Confirmação de Reserva)
    Web-->>User: 16. Renderização na Agenda Multiusuário
```

---

## 2. Pontos de Entrada, Processamento e Armazenamento

1. **Ingresso (Coleta)**:
   - Formulários administrativos para cadastro de usuários (nome, e-mail institucional).
   - Telas operacionais de agendamento de equipamentos e retirada de reagentes.
2. **Trânsito (Rede)**:
   - Criptografia obrigatória via HTTPS/TLS entre o navegador e o proxy institucional da Unicamp.
   - Comunicação local via interface de loopback (`127.0.0.1`) entre Apache2, Next.js, NestJS, PostgreSQL e Redis.
3. **Processamento e Autorização**:
   - Backend NestJS avalia autorização em nível de domínio (`PermissionEvaluator`).
   - Rate limiting intercepta requisições excessivas antes do processamento de hashing.
4. **Armazenamento Seguro**:
   - PostgreSQL com triggers de imutabilidade para `audit_events` e `stock_movements`.
   - Hashes de senha protegidos com Argon2id.
