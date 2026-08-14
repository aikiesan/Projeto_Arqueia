# ADR-001 — Execução nativa (sem Docker) na VM Debian

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto
A implantação será na VM institucional da Unicamp (Debian) que serve o cp2b.unicamp.br. **A VM não roda Docker.** A equipe já opera o cp2b com um fluxo nativo: `git pull` → `npm install` → `npm run build` → `pm2 restart`. A VM foi ampliada para 16 GB RAM, 8–12 CPUs e 100+ GB.

## Decisão
Executar Arqueia **nativamente**, sem Docker/Docker Compose:
- PostgreSQL e Redis instalados via `apt` e gerenciados por `systemd`.
- `api`, `web` e `worker` gerenciados por **PM2** (`pm2 save` + `pm2 startup`).
- Setup e deploy roteirizados em `infrastructure/scripts/`.

Isto substitui a recomendação de Docker Compose do plano de produto original.

## Consequências
- (+) Alinha-se ao que a equipe já sabe operar; sem nova dependência de runtime.
- (+) 16 GB/8–12 CPU acomodam com folga Postgres + Redis + 3 processos Node para uso interno.
- (−) Sem isolamento de contêiner; versões de Node/Postgres/Redis são responsabilidade do host (fixar via `.nvmrc` e pacotes `apt` pinados).
- (−) Paridade dev/prod exige disciplina (documentar versões em `ENVIRONMENTS.md`).

## Alternativas consideradas
- **Docker Compose:** descartado — a VM não suporta Docker.
- **VM nova dedicada:** descartado agora (ADR-002); custo/manutenção desnecessários para a carga esperada.
