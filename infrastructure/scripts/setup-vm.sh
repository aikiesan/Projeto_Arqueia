#!/usr/bin/env bash
# ============================================================
# Arqueia — setup inicial da VM (Debian, sem Docker). Idempotente
# onde possível. Rode uma vez. Passos com sudo pedem confirmação.
# Ver docs/deployment/VM-DEPLOYMENT.md para o passo a passo comentado.
# ============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/data/arqueia/repo}"

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

echo ">> Estrutura persistente em /data…"
sudo install -d -o "$USER" -g "$USER" -m 0750 \
  /data/arqueia /data/arqueia/backups /data/arqueia/logs /data/arqueia/releases
sudo install -d -o postgres -g postgres -m 0700 /data/arqueia/postgresql

echo ">> Extensão btree_gist (necessária p/ EXCLUDE de reservas):"
echo "   sudo -u postgres psql -d arqueia -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'"

cd "$REPO_DIR"
echo ">> .env"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo "   Criado .env a partir de .env.example. Preencha os valores de produção e execute novamente."
  exit 2
fi
if [ ! -r .env ]; then
  echo "   .env não está legível pelo usuário atual." >&2
  exit 1
fi
chmod 600 .env
set -a
# O arquivo é administrado na própria VM e deve conter atribuições shell válidas.
# shellcheck disable=SC1091
. ./.env
set +a

echo ">> Instalando dependências e buildando…"
# --include=dev e obrigatorio: o .env define NODE_ENV=production, e o npm usa
# isso para omitir devDependencies. O build depende de tsc, next e nest, que
# sao devDependencies — sem a flag o deploy morre com "tsc: not found".
npm ci --include=dev
NEXT_PUBLIC_BASE_PATH=/arqueia npm run build

echo ">> Migrações"
npm run db:migrate

cat <<'NEXT'

>> Passos manuais restantes:
   1. PostgreSQL: crie role, tablespace em /data/arqueia/postgresql e banco arqueia.
   2. Redis: sudo apt-get install -y redis-server && sudo systemctl enable --now redis-server
   3. Apache: incorpore infrastructure/proxy/cp2b-arqueia-path.apache.conf
      ao VirtualHost :80 existente e adicione RewriteCond para /arqueia.
   4. Valide: sudo /usr/sbin/apache2ctl configtest
   5. PM2 (usuário lucas, com .env já carregado):
      pm2 startOrRestart infrastructure/pm2/ecosystem.config.js --update-env && pm2 save
   6. Banco novo: crie o primeiro ADMIN com `npm run db:bootstrap-admin` seguindo
      docs/deployment/VM-DEPLOYMENT.md. Não execute o seed em produção.
NEXT
echo ">> setup-vm.sh concluído."
