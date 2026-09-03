# Plano — Identidade institucional e implantação na VM CP2B

## Objetivo

Publicar o Arqueia em `/arqueia` na VM Debian existente, usando Apache, PM2, PostgreSQL e Redis, com login por nome/e-mail institucional.

## Contratos

- Criação: `name`, `email`, categoria, laboratório e senha temporária.
- Login: `email` e `password`.
- E-mail: minúsculo, único e pertencente a `unicamp.br` ou subdomínio.
- Senha: 12–128 caracteres, sem exigência de classes de caracteres.
- URL pública: `https://cp2b.unicamp.br/arqueia`.

## Critérios de aceite

1. Nome/e-mail são validados, normalizados e únicos.
2. Login não enumera contas e mantém lockout/rate limit.
3. Conta temporária exige troca de senha.
4. Cookies e navegação funcionam sob `/arqueia`.
5. API/Web escutam apenas loopback nas portas 4001/4002.
6. Banco reside no tablespace de `/data` e Redis não é exposto externamente.
7. Apache não interfere em `/api`, `/pilar2b` ou `/abiove`.
8. Setup, deploy, backup e rollback não imprimem segredos.
9. Testes, lint, typecheck e build ficam verdes.

## Estratégia de testes

- Contratos: domínio institucional, normalização e rejeição de campos inválidos.
- API: login por e-mail, credencial inválida, bloqueio e reautenticação.
- Banco: migração incremental, unicidade case-insensitive e suspensão de contas antigas.
- Web: formulário por e-mail, criação/edição e troca obrigatória.
- Infraestrutura: validação do Apache, PM2, health checks e rollback.
