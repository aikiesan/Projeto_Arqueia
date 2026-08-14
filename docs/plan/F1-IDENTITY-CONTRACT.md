# Fase 1 — Contrato de identidade e RBAC

## Status

Contrato-âncora **congelado na versão 1.0.0**. Este documento detalha a primeira unidade coesa da
Fase 1 e complementa `ROADMAP.md` e `TASK-ORCHESTRATION.md`.

## Escopo

- Congelar os contratos compartilhados de `Institution`, `User`, `Laboratory`,
  `Project`, `Role`, `Membership` e autenticação local.
- Definir o modelo de autorização que separa papéis globais de papéis vinculados ao
  laboratório.
- Definir schemas de entrada e saída sem expor credenciais ou hashes.
- Entregar contratos compiláveis e testes de validação antes de implementar banco,
  API, adaptadores ou UI.

## Decisão de RBAC

`ADMIN` tem escopo de sistema, como exige `USER-ROLES.md`. Os demais papéis internos
(`USUARIO`, `TECNICO`, `RESPONSAVEL_CONTROLADOS`) têm escopo de laboratório.

- `Membership` representa exatamente `User × Laboratory × LaboratoryRole`.
- `SystemRoleAssignment` representa `User × SystemRole` e inicialmente aceita apenas
  `ADMIN`.
- Não existe `isAdmin`, `isTechnician` ou qualquer booleano global no usuário.
- A API decide a autorização usando o recurso-alvo e o laboratório desse recurso.
- A UI pode usar as mesmas permissões para apresentação, mas nunca é a autoridade.

Esse desenho evita replicar uma membership de administrador para cada laboratório e
evita que a criação de um laboratório novo altere implicitamente a autorização.

## Contratos de entrada e saída

- IDs são UUIDs.
- Datas atravessam a fronteira como ISO 8601 UTC/offset.
- E-mails são normalizados para minúsculas.
- Entidades operacionais expõem `archivedAt`; exclusão física não integra o contrato.
- Segredos, hashes de senha e dados de MFA nunca integram `User`.
- Login local recebe e-mail/senha e devolve token de acesso + contexto do usuário; o
  refresh token será transportado em cookie `HttpOnly` pela camada HTTP.
- Listagens usam paginação por cursor, evitando contratos diferentes por aplicação.

## Critérios de aceite

1. `@arqueia/contracts` compila para ESM e gera declarações TypeScript.
2. Schemas Zod validam todos os DTOs públicos do contexto de identidade.
3. `Membership` não aceita `ADMIN`; atribuição global não aceita papel laboratorial.
4. Código compartilhado publica a matriz papel → permissão para consistência de UI,
   enquanto a decisão efetiva permanece no domínio da API.
5. Testes cobrem normalização, limites dos campos, escopo dos papéis e rejeição de
   credenciais em respostas públicas.
6. Nenhum código deste bloco importa NestJS, banco, Redis ou HTTP.

## Fora do escopo deste bloco

- Persistência e migrações.
- Hash de senha, emissão/verificação JWT e integração OIDC.
- Controllers e CRUD.
- Telas.

Esses itens são liberados somente após este contrato ficar verde.
