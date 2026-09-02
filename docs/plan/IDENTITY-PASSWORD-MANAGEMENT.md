# Gestão de credenciais locais

## Escopo

Adicionar os casos de uso de troca da própria senha e reset administrativo de senha para contas locais. Lockout de login, rate limiting, UI/BFF, MFA e revogação de sessões ficam fora deste PR.

## Contratos

- `POST /api/auth/change-password`: exige JWT, senha atual válida e nova senha com 12–128 caracteres.
- `POST /api/users/:userId/password-reset`: exige papel global `ADMIN`, reautenticação do administrador e nova senha válida.
- A nova senha nunca cruza portas de persistência em texto puro; somente o hash Argon2id é persistido.
- Senha atual e hash armazenado são enviados a `PasswordVerifier.verify(password, passwordHash)` nessa ordem.
- A alteração da credencial e seu evento de auditoria ocorrem na mesma transação.

## Arquitetura SOLID

- `CurrentCredentialReader` lê somente o hash da conta autenticada.
- `UserCredentialWriter` escreve somente credenciais e sua auditoria.
- Os casos de uso orquestram verificação, autorização e hashing sem importar PostgreSQL, HTTP ou Argon2.
- Controllers apenas validam/traduzem HTTP e delegam para os casos de uso.

## Critérios de aceite

- Senha atual inválida não calcula nem persiste um novo hash.
- Reset administrativo sem permissão ou reautenticação é rejeitado.
- Atualização bem-sucedida limpa lockout anterior sem expor hashes na auditoria.
- Contratos, casos de uso, lint, typecheck, testes da API e build passam.

## Risco e continuidade

Risco moderado por alterar credenciais. Tokens JWT emitidos anteriormente continuam válidos até o TTL atual; revogação de sessões será tratada no ADR/PR específico de sessões revogáveis.
