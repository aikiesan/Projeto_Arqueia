# Probes de saúde de produção

## Escopo

Substituir o health check superficial da API por uma verificação ativa de PostgreSQL e Redis e expor o resultado pelo BFF Web. Alterações de autenticação, configuração institucional e deploy ficam fora deste PR.

## Contratos

### API

- `GET /health` e `GET /api/health`.
- `200`: `{ status: "ok", service: "arqueia-api", timestamp, database: "connected", redis: "connected" }`.
- `503`: o mesmo envelope com `status: "error"` e cada dependência marcada como `connected` ou `disconnected`.
- Cada probe tem timeout de dois segundos e falha de forma segura.

### Web BFF

- `GET /api/health` consulta a API sem cache.
- Propaga sucesso como `200` e degradação/indisponibilidade como `503`.
- Respostas usam `Cache-Control: no-store`.

## Arquitetura

- `HealthController` coordena os probes e traduz o resultado HTTP.
- `RedisClient` é uma porta pequena para `PING`; o adapter TCP/TLS vive em infraestrutura compartilhada.
- `HealthModule` compõe banco, Redis e controller; `AppModule` conhece somente o módulo de feature.

## Critérios de aceite

- PostgreSQL executa `SELECT 1` e Redis responde `PONG` no caminho saudável.
- Falha isolada ou combinada retorna `503` com diagnóstico por dependência.
- O BFF não transforma indisponibilidade em sucesso nem armazena o resultado em cache.
- Testes direcionados, lint, typecheck e build passam.
- Smoke test contra os serviços Docker retorna `200` nos dois endpoints.

## Risco e rollback

Risco moderado: readiness passa a refletir dependências reais e pode reiniciar ou retirar instâncias degradadas de rotação. Rollback por reversão do commit; sem migração de dados.
