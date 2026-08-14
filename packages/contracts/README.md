# @arqueia/contracts

**Fonte da verdade** de tipos e schemas do sistema. Tudo que atravessa a fronteira entre `web`, `api` e `worker` é definido aqui (DTOs, schemas de validação, enums de status, tipos de domínio compartilhados).

Ninguém redefine contrato localmente. Este é o pacote que o **Opus congela** para destravar o trabalho paralelo do **Haiku** (ver `docs/plan/TASK-ORCHESTRATION.md`).

Sugestão de organização: um subdiretório por bounded context (`identity/`, `inventory/`, `controlled/`, `equipment/`, `scheduling/`, `multiuser/`, `management/`).
