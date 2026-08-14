# Implantação na VM (Debian, sem Docker) — Arqueia

Alvo: mesma VM do cp2b.unicamp.br, subdomínio `arqueia.cp2b.unicamp.br`, Apache2 + PM2 + PostgreSQL/Redis nativos. Espelha o fluxo que a equipe já usa no cp2b.

> **Confirme antes:** o proxy na frente é Apache2 (declarado) ou nginx (material de referência do cp2b)? `apache2 -v` e `nginx -v`. Os passos abaixo assumem **Apache2**.

## 0. DNS
Criar registro A: `arqueia.cp2b.unicamp.br → 177.220.121.2` (TTL 300). Verificar: `dig +short arqueia.cp2b.unicamp.br`.

## 1. Dependências do sistema (uma vez)
```bash
# Node 20 LTS (confirmar versão do .nvmrc)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL + extensões (btree_gist para EXCLUDE de reservas)
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

# Redis
sudo apt-get install -y redis-server
sudo systemctl enable --now postgresql redis-server

# PM2 global
sudo npm install -g pm2
```

## 2. Banco
```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE arqueia LOGIN PASSWORD 'TROCAR';
CREATE DATABASE arqueia OWNER arqueia;
\c arqueia
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
```

## 3. Código + build
```bash
# repositório próprio do Arqueia (ex.: /var/www/arqueia/repo)
cd /var/www/arqueia/repo
git pull origin main
npm install
npm run build          # constrói contracts → api → web
```

`.env` (a partir de `.env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT/SECRET`, `PUBLIC_ORIGIN=https://arqueia.cp2b.unicamp.br`, portas 4001/4002, SMTP.

## 4. Migrações + seed
```bash
npm run db:migrate
npm run db:seed        # apenas em dev/homolog
```

## 5. PM2
```bash
pm2 start infrastructure/pm2/ecosystem.config.js
pm2 save
pm2 startup            # gerar/instalar o serviço systemd do PM2 (sobrevive a reboot)
```

## 6. Apache2 (VirtualHost + TLS)
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite
sudo cp infrastructure/proxy/arqueia.cp2b.unicamp.br.apache.conf \
        /etc/apache2/sites-available/
sudo a2ensite arqueia.cp2b.unicamp.br.apache.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

# Expandir o certificado existente para o subdomínio
sudo certbot --apache -d cp2b.unicamp.br -d arqueia.cp2b.unicamp.br
```

## 7. Verificação (health checks)
```bash
pm2 list                                                   # api, web, worker: online
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4002          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://arqueia.cp2b.unicamp.br # 200
```

## Deploy recorrente (após a configuração inicial)
Roteirizado em `infrastructure/scripts/deploy-vm.sh`:
```bash
cd /var/www/arqueia/repo
git pull origin main
npm install
npm run build
npm run db:migrate
pm2 restart ecosystem.config.js
pm2 save
# health checks acima
```

O cp2b permanece **inalterado**: bancos, portas (3001) e processos PM2 são separados.
