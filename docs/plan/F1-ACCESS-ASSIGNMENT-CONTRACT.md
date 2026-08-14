# F1 — Contrato de Atribuição de Acesso (memberships & papel de sistema)

> Status: **v1.0.0** · Fase 1 (Track A — Identidade & Acesso) · Domínio **crítico** (permissões/auditoria) → exige revisão Opus (AGENTS.md §2, §4).
> Complementa [`F1-IDENTITY-CONTRACT.md`](./F1-IDENTITY-CONTRACT.md) e implementa a parte de "atribuir/revogar papéis" adiada em [`F1-LOCAL-FOUNDATION-VERIFICATION.md`](./F1-LOCAL-FOUNDATION-VERIFICATION.md).

## 1. Escopo

Fecha a lacuna de **atribuição e revogação de acesso** sobre o modelo já congelado:

- `Membership` = `User × Laboratory × LaboratoryRole` (`USUARIO | TECNICO | RESPONSAVEL_CONTROLADOS`).
- `SystemRoleAssignment` = `User × SystemRole` (apenas `ADMIN`).

Não altera o contrato de identidade v1.0.0; apenas adiciona schemas de **requisição** e endpoints.

## 2. Autorização

- Toda operação exige a permissão **`identity.membership.manage`**, que hoje pertence **somente ao papel de sistema `ADMIN`** (ver `packages/contracts/src/identity/permissions.ts`).
- Avaliada **no servidor** via `PermissionEvaluator.assertCan` (não negociável #5). O cliente apenas esconde/mostra a UI.

## 3. Reautenticação (ponte interina até MFA)

O `SECURITY.md` exige reautenticação/MFA para mudanças de permissão. Enquanto o contrato de MFA não existe, **toda** requisição de atribuição/revogação carrega `confirmationPassword`, verificada no servidor contra a credencial local do **próprio ator** (`ReauthenticationService` → `LocalIdentityReader` + `PasswordVerifier`). A senha:

- nunca é persistida;
- nunca entra em auditoria;
- falha → `401 INVALID_CREDENTIALS` (via `InvalidCredentialsError`).

Quando o contrato de MFA existir, ele **substitui** este campo por um fator forte, sem alterar a forma dos endpoints além do payload de reauth.

## 4. Endpoints (`@Controller('api/access')`, protegido por `JwtAuthGuard`)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| `POST` | `/api/access/memberships` | `assignMembershipRequestSchema` = `{ userId, laboratoryId, role, confirmationPassword }` | `Membership` |
| `DELETE` | `/api/access/memberships/:membershipId` | `revokeAccessRequestSchema` = `{ confirmationPassword }` | `Membership` (arquivado) |
| `POST` | `/api/access/system-roles` | `assignSystemRoleRequestSchema` = `{ userId, role, confirmationPassword }` | `SystemRoleAssignment` |
| `DELETE` | `/api/access/system-roles/:assignmentId` | `revokeAccessRequestSchema` | `SystemRoleAssignment` (arquivado) |

Schemas em `packages/contracts/src/identity/membership.ts` (fonte da verdade).

### Erros
- `403 AUTHORIZATION_DENIED` — ator sem `identity.membership.manage`.
- `401 INVALID_CREDENTIALS` — `confirmationPassword` inválida.
- `404 IDENTITY_ENTITY_NOT_FOUND` — id de membership/assignment inexistente ou já arquivado.
- `409 IDENTITY_CONFLICT` — atribuição duplicada (índice único parcial) ou FK inválida.
- `400 VALIDATION_ERROR` — corpo/params fora do schema.

## 5. Invariantes (verificação)

1. **Revogar = arquivar** (`archived_at = now()`), nunca `DELETE` (não negociável #6). Os índices únicos parciais `WHERE archived_at IS NULL` permitem reatribuir o mesmo papel depois.
2. **Auditoria imutável** em toda mutação (não negociável #4), via `appendMutationAudit`, com ações:
   `identity.membership.assigned` · `identity.membership.revoked` · `identity.system_role.assigned` · `identity.system_role.revoked`, registrando ator, `before`/`after`, origem e `request_id`.
3. Cada caso de uso faz **uma** intenção (SRP); portas de escrita são **segregadas** (`MembershipWriter`, `SystemRoleWriter`).
4. O `PrincipalReader` recarrega memberships/systemRoles do banco a cada `GET /me`, então o efeito de uma atribuição/revogação aparece no próximo request autenticado do usuário-alvo.

## 6. Extensão v1.1 — leitura administrativa de acessos

Para que a interface administrativa mostre e revogue atribuições reais, fica
adicionado `GET /api/access?userId=:userId`. O endpoint exige
`identity.membership.manage`, retorna somente memberships e papéis de sistema ativos
do usuário e nunca inclui credenciais, hashes ou eventos de auditoria. Entrada e saída
são validadas por `userAccessQuerySchema` e `userAccessSnapshotSchema` em
`packages/contracts`. Esta extensão substitui a postergação de listagem registrada na
versão 1.0 abaixo.

## 7. Fora deste contrato (adiado)

- MFA/TOTP real e reautenticação forte (substituirão `confirmationPassword`).
- Arquivamento de usuários/laboratórios/projetos e lockout de credenciais.
- Fluxo OIDC/SSO real.
- Endpoint de listagem dedicada de memberships (a leitura vem do `principal`/`GET /me` e da lista de usuários).
