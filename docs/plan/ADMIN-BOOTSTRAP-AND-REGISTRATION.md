# Plano — primeiro administrador e solicitação de cadastro

## Escopo imediato

Criar um comando seguro e idempotente para inicializar o primeiro administrador em banco já migrado, inclusive em produção, sem seed de demonstração e sem senha em argumento de linha de comando.

### Entrada

- `DATABASE_URL` carregada do `.env` da VM.
- `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` obtidos por prompt Bash.
- Dados institucionais/laboratoriais opcionais, com padrões Unicamp/CP2B.

### Saída

- Instituição e laboratório básicos existentes.
- Um usuário ativo, credencial Argon2id e papel de sistema `ADMIN`.
- Evento de auditoria append-only.
- Recusa da operação quando já existir ADMIN ativo.

### Critérios de aceite

- E-mail precisa pertencer a `unicamp.br` ou subdomínio.
- Senha possui 12–128 caracteres, sem regra de composição.
- A senha nunca é impressa nem recebida como argumento CLI.
- Falha transacional não deixa cadastro parcial.
- Testes cobrem validação, primeiro bootstrap, recusa do segundo ADMIN e rollback.

## Cadastro de usuários existente

O fluxo atual é administrativo: ADMIN ou gestor autorizado cria uma conta ativa com senha provisória e atribuição inicial ao laboratório. Também pode suspender, reativar, redefinir senha e gerenciar papéis.

## Evolução proposta: auto cadastro com aprovação

Ainda não implementada. O contrato deve contemplar:

1. usuário informa nome, e-mail institucional, categoria e senha;
2. comprovação de posse do e-mail por link/código de uso único;
3. solicitação permanece `INVITED`, sem sessão nem acesso operacional;
4. coordenação aprova ou recusa e escolhe laboratórios/papéis;
5. todas as transições geram auditoria e notificação;
6. rate limit, resposta anti-enumeração e expiração de tokens.

Não publicar auto cadastro sem entrega de e-mail configurada ou outro método institucional de comprovação de identidade.
