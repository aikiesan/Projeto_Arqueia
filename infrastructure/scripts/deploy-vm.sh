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

echo ">> health checks"
MAX_RETRIES=10
attempt=1
success=0

while [ "$attempt" -le "$MAX_RETRIES" ]; do
  code_api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health || true)
  code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/api/health || true)
  echo "   [tentativa $attempt/$MAX_RETRIES] api:4001/api/health -> ${code_api}, web:4002/api/health -> ${code_web}"
  if [ "$code_api" = "200" ] && [ "$code_web" = "200" ]; then
    success=1
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

if [ "$success" -eq 1 ]; then
  echo ">> Deploy e health checks concluídos com sucesso."
else
  echo "!! Falha no health check após $MAX_RETRIES tentativas"
  exit 1
fi
