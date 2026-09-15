-- Libera o Cromatógrafo Gasoso Shimadzu GC-2030NS para reserva em produção.
--
-- PROBLEMA
-- O equipamento está cadastrado com requires_training = true, mas o fluxo de
-- habilitação de treinamento não existe no código: CreateReservationUseCase
-- lança EquipmentTrainingRequiredError incondicionalmente quando a flag está
-- ligada. Na prática, ninguém — nem aluno, nem técnico, nem admin — consegue
-- reservar o GC enquanto ela estiver assim.
--
-- Não é uma migração: é correção de dado operacional, decidida para o piloto.
-- Por isso vive aqui e não em packages/database/migrations.
--
-- COMO RODAR NA VM
--   cd /data/arqueia/repo
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/sql/2026-09-15-liberar-gc-para-reserva.sql
--
-- Casa por `code`, e não por UUID: os identificadores de produção são
-- diferentes dos de desenvolvimento. É idempotente — rodar duas vezes não faz
-- mal. Faça o backup antes (infrastructure/scripts/backup-vm.sh).

\echo '== ANTES =='

SELECT l.code            AS laboratorio,
       e.code            AS equipamento,
       e.name,
       e.status,
       e.requires_training,
       e.requires_approval,
       e.max_reservation_minutes,
       e.absence_release_minutes
  FROM equipment e
  JOIN laboratories l ON l.id = e.laboratory_id
 WHERE e.code = 'EQ-SHIMADZU-GC2030'
   AND e.archived_at IS NULL;

BEGIN;

UPDATE equipment
   SET requires_training = false,
       updated_at        = now()
 WHERE code = 'EQ-SHIMADZU-GC2030'
   AND archived_at IS NULL
   AND requires_training IS TRUE;

-- O equipamento também precisa estar AVAILABLE: qualquer outro status faz
-- CreateReservationUseCase lançar EquipmentUnavailableError.
UPDATE equipment
   SET status     = 'AVAILABLE',
       updated_at = now()
 WHERE code = 'EQ-SHIMADZU-GC2030'
   AND archived_at IS NULL
   AND status <> 'AVAILABLE';

COMMIT;

\echo '== DEPOIS (requires_training deve estar f, status AVAILABLE) =='

SELECT l.code            AS laboratorio,
       e.code            AS equipamento,
       e.status,
       e.requires_training,
       e.requires_approval
  FROM equipment e
  JOIN laboratories l ON l.id = e.laboratory_id
 WHERE e.code = 'EQ-SHIMADZU-GC2030'
   AND e.archived_at IS NULL;

-- Código a gravar na etiqueta QR física. A tela de Equipamentos já gera e
-- imprime esta etiqueta ("Etiqueta QR" no card) — esta consulta serve só para
-- conferência, ou para gerar a etiqueta por fora.
\echo '== Conteúdo da etiqueta QR =='

SELECT e.code AS equipamento,
       'https://cp2b.unicamp.br/arqueia/qr?code=ARQ-EQP-' || e.id AS conteudo_do_qr
  FROM equipment e
 WHERE e.code = 'EQ-SHIMADZU-GC2030'
   AND e.archived_at IS NULL;

-- PARA REVERTER
--   UPDATE equipment SET requires_training = true, updated_at = now()
--    WHERE code = 'EQ-SHIMADZU-GC2030' AND archived_at IS NULL;
