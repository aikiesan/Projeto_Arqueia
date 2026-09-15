-- Deixa apenas o Cromatógrafo Gasoso Shimadzu GC-2030NS visível no CP2b,
-- arquivando os demais equipamentos para o piloto.
--
-- ARQUIVAR NÃO APAGA: preenche equipment.archived_at. O histórico de reservas,
-- movimentações e auditoria continua intacto, e a reversão é uma linha (ao pé
-- deste arquivo). Ainda assim, faça o backup antes:
--   bash infrastructure/scripts/backup-vm.sh
--
-- POR QUE PULAR EQUIPAMENTO COM RESERVA VIVA
-- O check-in pela etiqueta QR exige equipment.archived_at IS NULL
-- (postgres-scheduling-repository.checkInReservationByEquipment). Arquivar um
-- equipamento que ainda tem reserva em aberto faria o check-in daquela pessoa
-- falhar com EQUIPMENT_NOT_FOUND. Já a agenda continuaria mostrando a reserva,
-- porque listSchedule não filtra equipamento arquivado — ou seja, a pessoa veria
-- a reserva e não conseguiria iniciá-la. Por isso o script preserva esses casos
-- e apenas os lista, para decisão humana.
--
-- COMO RODAR NA VM
--   cd /data/arqueia/repo
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/sql/2026-09-15-arquivar-equipamentos-nao-piloto.sql
--
-- Casa por `code`, não por UUID: os identificadores de produção diferem dos de
-- desenvolvimento. Idempotente.

\set ON_ERROR_STOP on
\set piloto '''EQ-SHIMADZU-GC2030'''

\echo ''
\echo '== 1. Equipamentos ativos no CP2b hoje =='

SELECT e.code, e.name, e.status
  FROM equipment e
  JOIN laboratories l ON l.id = e.laboratory_id
 WHERE l.code = 'CP2b'
   AND e.archived_at IS NULL
 ORDER BY e.name;

\echo ''
\echo '== 2. PRESERVADOS: têm reserva ou bloqueio em aberto (NÃO serão arquivados) =='

SELECT e.code,
       e.name,
       count(*)            AS ocupacoes_abertas,
       min(o.starts_at)    AS proxima,
       max(o.ends_at)      AS ultima
  FROM equipment e
  JOIN laboratories l           ON l.id = e.laboratory_id
  JOIN equipment_occupations o  ON o.equipment_id = e.id
 WHERE l.code = 'CP2b'
   AND e.archived_at IS NULL
   AND e.code <> :piloto
   AND o.archived_at IS NULL
   AND o.status NOT IN ('CANCELLED', 'RELEASED_ABSENCE')
   AND o.ends_at > now()
 GROUP BY e.code, e.name
 ORDER BY e.name;

\echo ''
\echo '== 3. Arquivando os demais =='

BEGIN;

UPDATE equipment e
   SET archived_at = now(),
       updated_at  = now()
  FROM laboratories l
 WHERE l.id = e.laboratory_id
   AND l.code = 'CP2b'
   AND e.archived_at IS NULL
   AND e.code <> :piloto
   -- Preserva quem ainda tem compromisso em aberto.
   AND NOT EXISTS (
         SELECT 1
           FROM equipment_occupations o
          WHERE o.equipment_id = e.id
            AND o.archived_at IS NULL
            AND o.status NOT IN ('CANCELLED', 'RELEASED_ABSENCE')
            AND o.ends_at > now()
       );

COMMIT;

\echo ''
\echo '== 4. DEPOIS: equipamentos ativos no CP2b =='

SELECT e.code, e.name, e.status
  FROM equipment e
  JOIN laboratories l ON l.id = e.laboratory_id
 WHERE l.code = 'CP2b'
   AND e.archived_at IS NULL
 ORDER BY e.name;

\echo ''
\echo 'Se a lista acima trouxer algo além do GC-2030NS, veja o bloco 2: são os'
\echo 'equipamentos preservados por terem reserva em aberto.'

-- PARA REVERTER (traz todos de volta):
--   UPDATE equipment e SET archived_at = NULL, updated_at = now()
--     FROM laboratories l
--    WHERE l.id = e.laboratory_id AND l.code = 'CP2b';
--
-- PARA REVERTER UM SÓ:
--   UPDATE equipment SET archived_at = NULL, updated_at = now()
--    WHERE code = 'EQ-HACH-DR6000';
