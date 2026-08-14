# @arqueia/worker

Processador assíncrono que consome filas Redis. Responsável por trabalho que não deve bloquear a requisição do usuário:

- E-mails e notificações (app/e-mail).
- **Alertas temporais:** estoque mínimo, validade de reagentes/padrões/soluções, calibração vencendo, "reserva começa em 30 min", **liberação por ausência** (check-in não feito na janela).
- Geração de relatórios Excel/PDF (consumo, custo por projeto).

Compartilha tipos com a API via `@arqueia/contracts` e lê/grava pelo `@arqueia/database`.

> Fase atual: esqueleto. O motor de alertas é tarefa [O] da Fase 3.
