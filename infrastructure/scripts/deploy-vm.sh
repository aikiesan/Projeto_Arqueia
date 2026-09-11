#!/usr/bin/env bash
# ============================================================
# Arqueia — deploy recorrente na VM. Espelha o fluxo do cp2b.
# ============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/data/arqueia/repo}"
cd "$REPO_DIR"

if [ ! -r .env ]; then
  echo "!! .env ausente ou não legível em ${REPO_DIR}." >&2
  exit 1
fi
set -a
# O arquivo é administrado na própria VM e deve conter atribuições shell válidas.
# shellcheck disable=SC1091
. ./.env
set +a

echo ">> git pull"
git pull origin main

echo ">> install + build"
# --include=dev e obrigatorio: o .env define NODE_ENV=production, e o npm usa
# isso para omitir devDependencies. O build depende de tsc, next e nest, que
# sao devDependencies — sem a flag o deploy morre com "tsc: not found".
npm ci --include=dev
NEXT_PUBLIC_BASE_PATH=/arqueia npm run build

echo ">> migrações"
npm run db:migrate

echo ">> restart PM2"
pm2 startOrReload infrastructure/pm2/ecosystem.config.js --update-env
pm2 save

echo ">> health checks (polling com retry)"
MAX_RETRIES=10
RETRY_DELAY=2
attempt=1
healthy=false
code_api="000"
code_web="000"

while [ "$attempt" -le "$MAX_RETRIES" ]; do
  code_api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health || true)
  if [ "$code_api" != "200" ]; then
    code_api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/health || true)
  fi

  code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/arqueia/api/health || true)
  if [ "$code_web" != "200" ]; then
    code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/arqueia/login || true)
  fi
  echo "   [Tentativa ${attempt}/${MAX_RETRIES}] api:4001/api/health -> ${code_api} | web:4002/arqueia/api/health -> ${code_web}"

  if [ "$code_api" = "200" ] && [ "$code_web" = "200" ]; then
    healthy=true
    break
  fi

  if [ "$attempt" -lt "$MAX_RETRIES" ]; then
    sleep "$RETRY_DELAY"
  fi
  attempt=$((attempt + 1))
done

if [ "$healthy" = true ]; then
  echo ">> OK — todos os serviços estão saudáveis."
else
  echo "!! Falha no health check após ${MAX_RETRIES} tentativas (api: ${code_api}, web: ${code_web})"
  exit 1
fi
