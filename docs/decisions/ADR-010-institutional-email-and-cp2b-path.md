# ADR 010: Identidade institucional e implantação em `/arqueia`

- **Status:** Aceito
- **Data:** 02/09/2026
- **Decisores:** Coordenação do CP2B, TI NIPE e arquitetura do Arqueia
- **Substitui parcialmente:** ADR-009

## Contexto

O Arqueia será publicado na mesma VM Debian do site CP2B, atrás do proxy HTTPS da Unicamp, sem Docker. A Coordenação decidiu coletar o mínimo necessário para facilitar o acesso: nome e e-mail institucional. Esses campos são dados pessoais comuns e alteram a classificação anterior de identidade apenas pseudonimizada.

## Decisão

1. O endereço público será `https://cp2b.unicamp.br/arqueia`.
2. O proxy institucional termina TLS; o Apache da VM recebe HTTP na porta 80.
3. Web, API e worker rodam via PM2 como usuário `lucas`.
4. O login usa e-mail terminado em `unicamp.br`, incluindo subdomínios institucionais.
5. Nome e e-mail são obrigatórios; `loginCode` permanece apenas como identificador técnico interno.
6. Senhas aceitam frases de 12 a 128 caracteres, sem regra de composição, com Argon2id, rate limit e lockout.
7. O banco `arqueia` usa tablespace em `/data/arqueia/postgresql`; não ocupa a raiz limitada da VM.
8. Redis permanece restrito ao loopback.

## Consequências

- O aviso de privacidade deve informar finalidade, responsáveis, retenção e direitos relativos a nome/e-mail.
- Contas migradas sem e-mail institucional ficam suspensas até regularização.
- Rotas, cookies e assets precisam respeitar o base path `/arqueia`.
- Não haverá novo certificado nem nova exposição pública de portas.
