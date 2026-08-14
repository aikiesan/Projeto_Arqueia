# Segurança, Operação e LGPD — Arqueia

A fundação de segurança é parte da Fase 1 (não é "para depois"). Requisitos não-funcionais que gates de verificação devem checar.

## Identidade e autenticação
- Integração com **SSO/LDAP/OIDC** da Unicamp quando disponível; contas locais como contingência.
- **MFA** para administradores e para operações críticas (retirada de controlado, alteração de permissões, arquivamento).
- Sessões com expiração; refresh seguro; logout invalida sessão.

## Autorização
- **Menor privilégio**, sempre avaliado no servidor, na dimensão **papel × laboratório** (ver `USER-ROLES.md`).
- Nenhuma decisão de acesso confia no cliente. A UI apenas oculta/exibe por conveniência.

## Controlados
- Dupla autenticação para retirada (FR-CTL-2); cadeia de custódia registrada (FR-CTL-3).
- Livro digital com status regulatório; export só liberado a papéis autorizados.

## Auditoria
- `AuditEvent` append-only para toda ação sensível: ator, data, origem, valores antes/depois.
- Auditoria não é editável nem apagável.

## Portal externo (multiusuário)
- Tokens de acompanhamento **não previsíveis** (aleatórios), com expiração e escopo mínimo.
- Rate limiting no endpoint público; proteção contra enumeração e spam de solicitações.

## Transporte e segredos
- TLS obrigatório (Let's Encrypt; cert existente expandido para o subdomínio — `ADR-002`).
- Segredos apenas em `.env` no servidor; somente `.env.example` versionado.
- Cabeçalhos de segurança no proxy Apache2 (HSTS, etc.).

## Backup e continuidade
- Backup automático de banco (`pg_dump` agendado) e dos documentos.
- **Procedimento de restauração testado** (não basta ter backup).
- Retenção definida por política.

## Monitoramento
- Saúde dos serviços (`/health` na api), erros, uso de disco, validade de certificado.
- Alertas ao responsável quando um limiar é cruzado.

## LGPD
- Mapeamento de dados pessoais (usuários internos e solicitantes externos).
- Política de retenção e **anonimização**; base legal para tratamento; via para exclusão/portabilidade.
- Minimização: coletar apenas o necessário no portal externo.

## Ambientes
- **dev → homolog → prod** separados (dados, credenciais e URLs distintos). Nada vai a produção sem passar por homologação. Ver `../deployment/ENVIRONMENTS.md`.
