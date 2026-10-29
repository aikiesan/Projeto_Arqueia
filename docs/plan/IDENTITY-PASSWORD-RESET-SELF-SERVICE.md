# Autoatendimento de redefinição de senha ("esqueci minha senha")

## Escopo

Fechar a lacuna deixada por `IDENTITY-PASSWORD-MANAGEMENT.md`: até aqui, quem
esquecia a senha dependia de um administrador. Este trabalho entrega o caminho
público — pedir o link por e-mail institucional e escolher uma senha nova — mais
a saída de emergência por linha de comando, para quando ninguém consegue entrar.

Fora de escopo: revogação das sessões ativas após a troca (segue dependendo do
ADR de sessões revogáveis), SSO/OIDC e segundo fator.

## Contratos

- `POST /api/auth/password-reset/request` — público, limitado por IP.
  Entrada `{ email }` com e-mail institucional da Unicamp. Resposta **sempre**
  `{ acknowledged: true }`, exista a conta ou não.
- `POST /api/auth/password-reset/complete` — público, limitado por IP.
  Entrada `{ token, newPassword }`, token em 64 hexadecimais e senha de 12–128
  caracteres. Token inválido, expirado ou já usado → `400` com código
  `INVALID_PASSWORD_RESET_TOKEN`.
- BFF: `/api/auth/password-reset/request` e `/complete` encaminham sem cookie de
  sessão, repassando o IP de origem.
- Telas: `/esqueci-senha` (pedido) e `/redefinir-senha?token=…` (nova senha).

## Decisões

1. **O token nunca é persistido em claro.** A tabela `password_reset_tokens`
   guarda o SHA-256; o segredo só existe no e-mail. Um dump do banco não
   redefine a senha de ninguém.
2. **Uso único garantido pelo banco.** O consumo é um único `UPDATE … WHERE
   used_at IS NULL AND expires_at > now() RETURNING`, e um gatilho recusa DELETE
   e qualquer alteração que não seja `used_at` de NULL para um instante
   (AGENTS.md §4.3, §4.4, §4.6).
3. **A resposta não revela se a conta existe.** Conta inexistente, suspensa ou
   arquivada recebem a mesma confirmação. Falha de entrega também é engolida:
   propagar o erro faria o formulário distinguir conta existente de inexistente
   pelo código HTTP. O que de fato aconteceu fica na auditoria, em
   `identity.password_reset.requested`, com `delivered` e `failureReason`.
4. **Um pedido novo cancela os anteriores.** Dois links válidos ao mesmo tempo
   só ampliam a janela em que um e-mail antigo ainda abre a conta.
5. **Redefinir pelo token não marca `must_change_password`.** A senha foi
   escolhida pelo dono da conta. Só a redefinição feita por um administrador —
   e a CLI de emergência — exige a troca no próximo login.
6. **Sem SMTP configurado, o link vai para o log da API**, com aviso em nível
   `warn`. É o modo de desenvolvimento; em `homolog` e `prod`, `SMTP_HOST` é
   obrigatório na prática.

## Arquitetura SOLID

- Portas novas, pequenas e separadas por intenção:
  `PasswordResetTokenWriter` (emitir), `PasswordResetTokenConsumer` (consumir),
  `PasswordResetNotifier` (avisar o dono da conta), `SecureTokenGenerator`
  (aleatoriedade injetável).
- `hashPasswordResetToken` e `passwordResetUrl` são funções puras do domínio.
- `PostgresPasswordResetTokenRepository` implementa as duas portas de token;
  `SmtpPasswordResetNotifier` e `LoggingPasswordResetNotifier` são adaptadores
  intercambiáveis da porta de notificação (Liskov na prática: o caso de uso não
  muda).
- O domínio não importa nodemailer, `pg` nem HTTP.

## Ambiente

- `PASSWORD_RESET_TOKEN_TTL_SECONDS` (300–86400, padrão 3600).
- `NEXT_PUBLIC_BASE_PATH` passa a ser lido também pela API, para montar um link
  que não caia em 404 sob subcaminho na VM do CP2b.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

## Saída de emergência

`npm run password:set --workspace @arqueia/database -- --email <e-mail>`,
com a senha em `ARQUEIA_NEW_PASSWORD` para não ficar no histórico do shell.
Grava auditoria com `origin = 'cli:password-set'`, zera o lockout, invalida
links pendentes e marca `must_change_password`. Existe para o caso em que
ninguém entra e o SMTP não está configurado — não é atalho de operação.

## Critérios de aceite

- Token em claro não aparece em nenhuma coluna nem na auditoria.
- E-mail desconhecido, conta suspensa e falha de SMTP produzem a mesma resposta
  que o caminho feliz.
- Um token só redefine a senha uma vez; a segunda tentativa recebe `400`.
- Contratos, casos de uso, lint, typecheck e as suítes de API, web, contracts e
  database passam.
