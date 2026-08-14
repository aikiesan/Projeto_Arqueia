#!/usr/bin/env bash
# ============================================================
# Arqueia — setup inicial da VM (Debian, sem Docker). Idempotente
# onde possível. Rode uma vez. Passos com sudo pedem confirmação.
# Ver docs/deployment/VM-DEPLOYMENT.md para o passo a passo comentado.
# ============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/arqueia/repo}"

echo ">> Verificando Node (>=20)…"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "   Instale Node 20 LTS:"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

echo ">> Verificando PostgreSQL, Redis e PM2…"
command -v psql  >/dev/null || echo "   Falta PostgreSQL: sudo apt-get install -y postgresql postgresql-contrib"
command -v redis-server >/dev/null || echo "   Falta Redis: sudo apt-get install -y redis-server"
command -v pm2   >/dev/null || echo "   Falta PM2: sudo npm install -g pm2"

echo ">> Extensão btree_gist (necessária p/ EXCLUDE de reservas):"
echo "   sudo -u postgres psql -d arqueia -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'"

echo ">> Instalando dependências e buildando…"
cd "$REPO_DIR"
npm install
npm run build

echo ">> .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Criado .env a partir de .env.example — PREENCHA: DATABASE_URL, REDIS_URL, JWT_SECRET, SMTP_*, PUBLIC_ORIGIN"
fi

echo ">> Migrações"
npm run db:migrate || echo "   (configure o script de migração em packages/database)"

cat <<'NEXT'

>> Passos manuais restantes:
   1. Apache2:
      sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite
      sudo cp infrastructure/proxy/arqueia.cp2b.unicamp.br.apache.conf /etc/apache2/sites-available/
      sudo a2ensite arqueia.cp2b.unicamp.br.apache.conf
      sudo apache2ctl configtest && sudo systemctl reload apache2
   2. TLS (expandir cert existente):
      sudo certbot --apache -d cp2b.unicamp.br -d arqueia.cp2b.unicamp.br
   3. PM2:
      pm2 start infrastructure/pm2/ecosystem.config.js && pm2 save && pm2 startup
NEXT
echo ">> setup-vm.sh concluído."
