#!/usr/bin/env bash
# ============================================================
# Arqueia — deploy recorrente na VM. Espelha o fluxo do cp2b.
# ============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/arqueia/repo}"
cd "$REPO_DIR"

echo ">> git pull"
git pull origin main

echo ">> install + build"
npm install
npm run build

echo ">> migrações"
npm run db:migrate || echo "   (sem migrações pendentes ou script não configurado)"

echo ">> restart PM2"
pm2 restart infrastructure/pm2/ecosystem.config.js
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

  code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/api/health || true)
  if [ "$code_web" != "200" ]; then
    code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002 || true)
  fi
  echo "   [Tentativa ${attempt}/${MAX_RETRIES}] api:4001/api/health -> ${code_api} | web:4002/api/health -> ${code_web}"

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
