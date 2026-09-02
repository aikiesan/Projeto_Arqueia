# Avaliação do Estado Atual de Segurança e Privacidade (Arqueia)

> **Classificação**: Documento Técnico de Engenharia
> **Status**: Evidência Técnica Consolidada (Pós-Hardening Fases 1 & 2.1)
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Unidade/Órgão Responsável pelo Tratamento**: `REQUIRES INSTITUTIONAL VALIDATION`
> **Conclusão Técnica**: `TECHNICALLY PREPARED FOR INSTITUTIONAL LGPD/RIPD REVIEW`

---

## 1. Contexto e Finalidade do Sistema

O **Arqueia** é uma plataforma institucional desenvolvida para gestão operacional, rastreabilidade e compartilhamento multiusuário de infraestrutura laboratorial de pesquisa (equipamentos científicos de médio/grande porte e estoque de insumos/reagentes) no âmbito da Universidade Estadual de Campinas (UNICAMP).

O sistema opera sob o modelo de **circuito fechado institucional**:
- **Ausência total de cadastro público (`No Public Signup`)**: Apenas pesquisadores, técnicos e alunos formalmente autorizados recebem credenciais via administração institucional.
- **Princípio da Minimização**: O Arqueia trata exclusivamente os dados estritamente necessários para autenticação institucional e registro de custódia e uso de recursos públicos de pesquisa.

---

## 2. Topologia de Arquitetura e Engenharia

- **Monorepo TypeScript**: Monorepo gerenciado por npm workspaces, tipagem estrita (`strict: true`) e contratos tipados compartilhados via `@arqueia/contracts`.
- **Backend (API)**: NestJS estruturado em 4 camadas SOLID (*domain*, *application*, *infrastructure*, *interface*), com isolamento estrito de regras de negócio.
- **Frontend (Web)**: Next.js 16 (App Router + React 19) operando como BFF (*Backend For Frontend*).
- **Processamento Assíncrono (Worker)**: Worker Node.js para processamento de tarefas em background.
- **Banco de Dados**: PostgreSQL 16 com extensão `btree_gist` para controle de concorrência temporal e triggers de imutabilidade.
- **Cache e Sessões**: Redis 7.
- **Ambiente de Produção**: Hospedagem nativa em VM Debian institucional gerenciada por PM2 e exposta através de proxy reverso Apache2 com HTTPS/TLS obrigatório na fronteira pública.

---

## 3. Controles Técnicos Implementados e Verificados

### 3.1. Autenticação e Gestão de Acesso
1. **Hashing de Senhas**: Implementado via **Argon2id** (`@node-rs/argon2`, $m=19456\text{ KB}$, $t=2$, $p=1$, len=32 bytes) com mecanismo constante de dummy hash para prevenção de ataques de enumeração e análise de tempo (*timing attacks*).
2. **Bloqueio por Tentativas Inválidas (Account Lockout)**:
   - Contadores atômicos `failed_attempts` e `locked_until` em `local_credentials`.
   - Limite configurável (`AUTH_MAX_FAILED_ATTEMPTS=5`, `AUTH_LOCKOUT_DURATION_SECONDS=900`).
   - Reset automático dos contadores após login bem-sucedido.
3. **Auditoria de Tentativas de Autenticação**:
   - Registro imutável de eventos `identity.login.succeeded` e `identity.login.failed`.
   - Sanitização total: senhas, hashes, tokens, cabeçalhos de autorização e cookies **nunca** são persistidos na trilha de auditoria.
   - Tratamento anônimo para usuários inexistentes (`actorId: null, entityId: '00000000-0000-0000-0000-000000000000'`).
4. **Rate Limiting em Camada de Aplicação**:
   - `AuthRateLimiterService` e `AuthRateLimitGuard` aplicados aos endpoints de login (`POST /api/auth/login`), troca de senha (`POST /api/auth/change-password`) e redefinição de senha (`POST /api/users/:userId/password-reset`).
   - Janela deslizante configurável (`AUTH_RATE_LIMIT_MAX_ATTEMPTS=10`, `AUTH_RATE_LIMIT_WINDOW_SECONDS=60`).
   - *Nota Arquitetural*: O limitador em memória é local ao processo (válido para instância única da API). Caso haja escalabilidade horizontal futura com múltiplas instâncias PM2, o limitador deverá ser chaveado para o backend compartilhado no Redis 7.
5. **Derivação Segura do IP do Cliente**:
   - O proxy Apache2 normaliza os cabeçalhos de encaminhamento (`X-Forwarded-For`), e o BFF repassa o IP original para o backend NestJS, evitando contorno de rate limit por spoofing e impedindo que requisições legítimas sejam acidentalmente agrupadas sob `127.0.0.1`.
6. **Segurança de Sessão**:
   - Token JWT de curta duração (padrão 15 min / 900s) encapsulado em cookie `httpOnly`, `Secure` (em produção), `SameSite=Strict`, `Path=/`.
   - Verificação estrita de cabeçalho `Origin` e `Host` (`hasTrustedOrigin`) no BFF.

### 3.2. Isolamento Multi-Laboratório (RBAC Papel × Laboratório)
- Cada recurso operacional (`equipment`, `reservations`, `products`, `batches`, `stock_movements`, `projects`) possui vínculo estrito com `laboratory_id`.
- Foreign keys compostas garantem integridade em nível de banco de dados.
- O `PermissionEvaluator` avalia a tupla `(Usuário, Papel, Laboratório)` no servidor antes de autorizar qualquer operação.

### 3.3. Imutabilidade e Integridade de Trilha de Auditoria
- Tabela `audit_events` protegida por trigger PL/pgSQL `reject_append_only_mutation()` que rejeita instruções `UPDATE` e `DELETE`.
- Livro-razão de estoque (`stock_movements`) opera em modo estritamente append-only.

### 3.4. Isolamento de Rede em Produção
- Parâmetro `API_HOST` configurado para `127.0.0.1` por padrão no backend NestJS e serviços auxiliares (PostgreSQL, Redis), garantindo que apenas o proxy reverso Apache2 tenha acesso às portas de aplicação locais.

---

## 4. Métricas de Qualidade e Verificação Técnica

- **Suíte de Testes Automatizados**: 348 testes automatizados reais (sem mocks em regras críticas de domínio) com **100% de aprovação**.
- **Typecheck Estático**: 0 erros em todos os pacotes e aplicações (`tsc --noEmit`).
- **Linter Estático**: 0 erros e 0 warnings no ESLint 9 (`eslint src --max-warnings=0`).
- **Build de Produção**: Compilação limpa de todos os pacotes e bundles Next.js/NestJS/Worker.
- **Auditoria de Dependências**: `npm audit` reportando 0 vulnerabilidades.
