# ADR-006 — Docker apenas para desenvolvimento local (produção continua nativa)

- **Status:** Aceito
- **Data:** 2026-08-14
- **Relacionado:** ADR-001 (execução nativa na VM sem Docker)

## Contexto
A VM de **produção** (Debian, cp2b) não roda Docker — ver ADR-001. Ainda assim, para **desenvolvimento local** é desejável subir Postgres, Redis, API, web e worker de forma reproduzível, isolada e descartável, sem instalar serviços na máquina do desenvolvedor. Docker Desktop resolve isso bem.

## Decisão
Docker é usado **exclusivamente como ambiente de desenvolvimento local** (Docker Desktop + `docker-compose.dev.yml`). **Produção permanece nativa** (PM2 + systemd) na VM, exatamente como no ADR-001.

Regras de coerência para não criar dependência de runtime:
- O **código da aplicação não depende de Docker**. Docker apenas orquestra serviços em dev; o mesmo build (`npm run build`) roda idêntico dentro do container (dev) e nativo na VM (prod).
- Configuração vem sempre de variáveis de ambiente (`.env`), nunca de suposições sobre Docker.
- O Postgres do compose habilita a extensão **`btree_gist`** (necessária para a constraint de exclusão de reservas — ADR-005), igual à VM.
- Versões de Node/Postgres/Redis no compose **espelham** as de produção (paridade dev/prod — ver `ENVIRONMENTS.md`).
- Nada do fluxo de deploy da VM (`setup-vm.sh`/`deploy-vm.sh`, vhost Apache2, PM2) passa a depender de Docker.

## Consequências
- (+) Dev local reproduzível e descartável; onboarding rápido; testes de integração contra Postgres/Redis reais.
- (+) Sem conflito com ADR-001: o artefato de produção continua nativo.
- (−) É preciso disciplina para manter paridade de versões entre o compose e a VM.
- (−) Dois caminhos de execução (container em dev, nativo em prod) exigem que ambos sejam testados no CI.

## Alternativas consideradas
- **Instalar Postgres/Redis direto na máquina do dev:** funciona, porém menos isolado/descartável.
- **Docker também em produção:** rejeitado — a VM não suporta (ADR-001).
