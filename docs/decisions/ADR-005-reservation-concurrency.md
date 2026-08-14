# ADR-005 — Concorrência de reservas garantida no banco

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto
Reserva de equipamentos é uma das áreas mais usadas. Duas pessoas podem tentar reservar o mesmo equipamento no mesmo horário simultaneamente. Validar só na interface deixa uma janela de corrida que gera reservas sobrepostas.

## Decisão
Impedir sobreposição no **banco de dados**: `Reservation` usa `tstzrange` e uma **constraint de exclusão** (`EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&)`). Inserção conflitante falha atomicamente. A criação de reservas recorrentes valida cada ocorrência contra a constraint, cria as livres e reporta as conflitantes (FR-AGD-3).

## Consequências
- (+) Impossível criar reservas sobrepostas, mesmo sob concorrência.
- (+) A UI apenas antecipa o feedback; a verdade é do banco.
- (−) Requer extensão `btree_gist` no Postgres e tratamento do erro de violação como "conflito" na aplicação.

## Alternativas consideradas
- **Validação apenas na aplicação/UI:** rejeitada — sujeita a corrida.
- **Lock pessimista por equipamento:** mais simples, porém serializa demais; a constraint de exclusão é mais precisa e concorrente.
