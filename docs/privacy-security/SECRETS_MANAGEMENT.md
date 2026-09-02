# Gestão de Segredos e Credenciais (Secrets Management)

> **Classificação**: Documento Técnico de Engenharia
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Regra Não Negociável #9**: Segredos nunca vão para o repositório git; apenas `.env.example` é versionado.

---

## 1. Inventário de Segredos e Chaves do Sistema

| Variável / Segredo | Componente | Finalidade | Requisito de Entropia / Formato |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | API (`apps/api`) | Assinatura e verificação criptográfica de tokens JWT. | Mínimo de 32 caracteres (256 bits de entropia criptográfica). |
| `DATABASE_URL` | API / Worker / Migrations | String de conexão com credenciais do PostgreSQL. | Usuário com permissões restritas e senha forte. |
| `REDIS_URL` | API / Worker | Conexão com a instância Redis de cache e filas. | URI com autenticação caso Redis exija senha. |
| `DEV_SEED_ADMIN_PASSWORD` | Database Seed | Senha do administrador gerada exclusivamente em desenvolvimento. | Proibido o uso em homologação ou produção. |
| `SMTP_PASSWORD` | Worker | Senha de autenticação no servidor SMTP institucional. | Armazenada no arquivo `.env` seguro na VM. |
| `OIDC_CLIENT_SECRET` *(Futuro)* | API | Segredo de cliente OIDC para integração com o IdP Unicamp. | Fornecido pelo órgão de TI central da Unicamp. |

---

## 2. Diretrizes de Armazenamento e Rotação

1. **Isolamento no Repositório**:
   - O arquivo `.gitignore` bloqueia explicitamente `.env`, `.env.*` e arquivos de log.
   - Nenhuma credencial de produção é commitada no código-fonte.
2. **Ambiente de Produção (VM Debian)**:
   - Os segredos residem no arquivo `.env` localizado na raiz do projeto na VM, com permissões de leitura restritas ao usuário de serviço (`chmod 600 .env`).
   - O PM2 injeta as variáveis no runtime das aplicações sem expô-las em processos externos.
3. **Procedimento de Rotação Emergencial**:
   - Em caso de suspeita de comprometimento da `JWT_SECRET`, basta alterá-la no `.env` da VM e reiniciar os processos com `pm2 restart ecosystem.config.js`. Todas as sessões anteriores serão imediatamente invalidadas.
