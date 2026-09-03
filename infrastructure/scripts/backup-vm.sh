#!/usr/bin/env bash
# Backup lógico do PostgreSQL na VM CP2B. Não imprime credenciais.
set -euo pipefail
umask 077

REPO_DIR="${REPO_DIR:-/data/arqueia/repo}"
BACKUP_DIR="${BACKUP_DIR:-/data/arqueia/backups}"
ENV_FILE="${ENV_FILE:-${REPO_DIR}/.env}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ ! -r "$ENV_FILE" ]; then
    echo "DATABASE_URL ausente e arquivo de ambiente não legível: ${ENV_FILE}" >&2
    exit 1
  fi
  set -a
  # O arquivo pertence à implantação e deve ter permissão 0600.
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL não foi definida." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +'%Y%m%d_%H%M%S')"
backup_file="${BACKUP_DIR}/arqueia_${timestamp}.dump"

echo ">> Gerando backup PostgreSQL em ${backup_file}"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --file="$backup_file"
pg_restore --list "$backup_file" >/dev/null
sha256sum "$backup_file" >"${backup_file}.sha256"

find "$BACKUP_DIR" -type f \
  \( -name 'arqueia_*.dump' -o -name 'arqueia_*.dump.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

echo ">> Backup criado e verificado: ${backup_file}"
