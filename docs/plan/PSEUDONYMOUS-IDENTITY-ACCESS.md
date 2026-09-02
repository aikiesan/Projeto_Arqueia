# Plano — Identidade pseudonimizada e acesso mínimo do CP2B

## Objetivo

Substituir o cadastro por nome/e-mail do Arqueia por uma identidade local pseudonimizada, escopada por laboratório e adequada ao MVP interno do CP2B.

## Contratos de entrada e saída

### Usuário

```ts
type AcademicCategory = 'IC' | 'MESTRADO' | 'DOUTORADO' | 'POS_DOUTORADO' | 'PESQUISADOR';

interface User {
  id: string;
  institutionId: string;
  loginCode: string;
  academicCategory: AcademicCategory;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  mustChangePassword: boolean;
}
```

### Login

- Entrada: `{ loginCode, password }`.
- Saída pública: principal sem hash, senha, nome, e-mail ou vínculo externo.
- `loginCode` é normalizado para maiúsculas e aceita `A-Z`, `0-9` e hífen.

### Criação

- Entrada: instituição, laboratório, categoria acadêmica e senha temporária.
- Saída: usuário `ACTIVE`, com código gerado pelo servidor, troca de senha obrigatória e membership `USUARIO` no laboratório informado.
- O gestor do CP2B pode conceder somente `USUARIO`; papéis elevados continuam restritos ao administrador técnico.

## Permissões

- `USUARIO`: laboratório/equipamento/agenda em leitura, reserva e cancelamento próprio.
- `GESTOR_ACESSO_CP2B`: leitura e gestão de usuários/memberships no próprio laboratório e aprovação de reservas.
- `ADMIN`: reservado para contingência de sistema; não é atribuído à Coordenação por padrão.

## Migração

Criar `011_pseudonymous_user_identity.cjs` sem editar migrações aplicadas. A migração adiciona e preenche os novos campos, atualiza constraints e remove os identificadores diretos após a transição.

## Critérios de aceite

1. Nenhum contrato público de usuário contém nome, e-mail, supervisor ou provedor OIDC.
2. Login local usa código e mantém proteção contra enumeração, lockout e rate limit.
3. Código duplicado é rejeitado no banco sem comparação sensível a maiúsculas.
4. Categoria acadêmica não altera permissões.
5. Usuário comum não possui estoque, gestão, auditoria ou reporte de incidente.
6. Gestor de acesso atua somente no laboratório de sua membership.
7. Reserva alheia não expõe usuário, projeto, finalidade ou notas.
8. Senha temporária exige alteração no primeiro acesso.
9. Migração funciona do zero e incrementalmente.
10. Testes unitários, integração, Web, e2e, lint, typecheck e build ficam verdes.

## Privacidade operacional

- Sessões persistem apenas identificadores técnicos, hash do refresh token e datas de validade/revogação; IP e user-agent não ficam no banco do Arqueia.
- O IP encaminhado pelo proxy pode ser processado transitoriamente para rate limit e pode existir nos logs da infraestrutura da Unicamp. Retenção, acesso e descarte desses logs precisam ser definidos com a TI institucional.
- O código é pseudônimo, não anônimo: a tabela externa código × pessoa permanece sob custódia institucional da Coordenação.

## Verificação local em 01/09/2026

- Migração `011_pseudonymous_user_identity` aplicada e seed idempotente executado.
- API, Web, worker, PostgreSQL e Redis iniciados com Docker Compose e saudáveis.
- Login local por código, troca obrigatória de senha e esquema mínimo conferidos.
- Suítes de contratos, banco, API e Web, lint, build de produção e validação do Compose aprovados.

## Testes

- Contrato: normalização, limites, enum e rejeição de campos antigos.
- Domínio: matriz positiva/negativa por papel e laboratório.
- API: login, lockout, suspensão, troca obrigatória e reset administrativo.
- PostgreSQL: unicidade do código, transação de criação e isolamento.
- Web: formulário por código, gestão mínima e ausência de identidade alheia.
- E2E: criar conta → primeiro login → trocar senha → reservar → cancelar própria reserva.

## Rollback

Antes de produção, rollback ocorre pela restauração do banco de homologação. Após produção, qualquer reversão preservará IDs, reservations e audit events; credenciais nunca serão exportadas em texto claro.
