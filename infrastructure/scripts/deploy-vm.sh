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
code_api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/health || true)
code_web=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002 || true)
echo "   api:4001/health -> ${code_api}"
echo "   web:4002        -> ${code_web}"
[ "$code_api" = "200" ] && [ "$code_web" = "200" ] && echo ">> OK" || { echo "!! Falha no health check"; exit 1; }
