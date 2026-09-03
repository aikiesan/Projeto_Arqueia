# Implantação na VM CP2B (Debian, sem Docker)

Alvo de produção: `https://cp2b.unicamp.br/arqueia`, na mesma VM do site CP2B. O proxy institucional termina o HTTPS antes da VM; o Apache2 local recebe HTTP na porta 80 e encaminha somente `/arqueia` para o Next.js.

## Topologia confirmada

```text
Internet -> proxy HTTPS Unicamp -> Apache2 :80
                                 -> Next.js/BFF :4002 (/arqueia)
                                      -> API NestJS :4001 (loopback)
                                           -> PostgreSQL :5432
                                           -> Redis :6379
```

- A API não é exposta diretamente pelo Apache.
- O site CP2B e suas rotas atuais permanecem no mesmo VirtualHost.
- Não instalar Certbot nem alterar o certificado: isso pertence ao proxy institucional.
- Dados persistentes e backups ficam em `/data/arqueia`, onde há espaço disponível.

## 1. Dependências (uma vez)

```bash
node --version
npm --version
psql --version
pm2 --version

sudo apt-get update
sudo apt-get install -y redis-server postgresql-contrib
sudo systemctl enable --now redis-server postgresql
```

A VM já possui Node 20, npm 10, PM2 e PostgreSQL 18. Não substitua essas instalações durante o primeiro deploy.

## 2. Diretórios e banco

```bash
sudo install -d -o lucas -g lucas -m 0750 \
  /data/arqueia /data/arqueia/backups /data/arqueia/logs /data/arqueia/releases
sudo install -d -o postgres -g postgres -m 0700 /data/arqueia/postgresql

sudo -u postgres psql -c "CREATE TABLESPACE arqueia_data LOCATION '/data/arqueia/postgresql';"
sudo -u postgres createuser --pwprompt arqueia
sudo -u postgres createdb --owner=arqueia --tablespace=arqueia_data arqueia
sudo -u postgres psql -d arqueia -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
```

Se role, banco ou tablespace já existirem, inspecione-os em vez de repetir a criação. A senha digitada no prompt deve ser exclusiva de produção.

## 3. Código e configuração

```bash
sudo install -d -o lucas -g lucas -m 0750 /data/arqueia/repo
cd /data/arqueia/repo
git clone https://github.com/aikiesan/Projeto_Arqueia.git .
git switch main
npm ci
cp .env.example .env
chmod 600 .env
```

Preencha `.env` somente na VM. Valores mínimos:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://arqueia:SENHA_URL_ENCODED@127.0.0.1:5432/arqueia
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=SEGREDO_ALEATORIO_LONGO
API_PORT=4001
WEB_PORT=4002
API_INTERNAL_URL=http://127.0.0.1:4001
PUBLIC_ORIGIN=https://cp2b.unicamp.br
NEXT_PUBLIC_BASE_PATH=/arqueia
```

Use os nomes efetivamente definidos em `.env.example`; não versione `.env` e não cole segredos em tickets ou logs.

## 4. Build, migrações e PM2

```bash
cd /data/arqueia/repo
npm ci
set -a
. ./.env
set +a
NEXT_PUBLIC_BASE_PATH=/arqueia npm run build
npm run db:migrate
pm2 startOrReload infrastructure/pm2/ecosystem.config.js --update-env
pm2 save
pm2 startup
```

Execute o comando `sudo` mostrado por `pm2 startup` para habilitar a restauração após reboot. Seed é permitido apenas em desenvolvimento/homologação.

### Primeiro administrador

Em banco novo, execute uma única vez. `read -s` impede que a senha apareça na tela ou no histórico:

```bash
cd /data/arqueia/repo
set -a
. ./.env
set +a

read -r -p 'Nome completo: ' BOOTSTRAP_ADMIN_NAME
read -r -p 'E-mail @unicamp.br: ' BOOTSTRAP_ADMIN_EMAIL
read -r -s -p 'Senha (12–128 caracteres): ' BOOTSTRAP_ADMIN_PASSWORD
echo
export BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
npm run db:bootstrap-admin
unset BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
```

O comando cria a instituição/laboratório básicos quando necessário e se recusa a executar se já houver ADMIN ativo. Depois do primeiro login, novos administradores e usuários são criados pela interface auditada.

## 5. Apache2

O arquivo `infrastructure/proxy/cp2b-arqueia-path.apache.conf` é um bloco para o VirtualHost `*:80` existente, não um novo site.

```bash
sudo a2enmod proxy proxy_http headers rewrite
sudoedit /etc/apache2/sites-available/ARQUIVO-ATUAL-DO-CP2B.conf
```

Insira o bloco antes das regras genéricas da SPA e de qualquer `ProxyPass /api`. Na regra de fallback da SPA, exclua `/arqueia` conforme o comentário do arquivo. Depois:

```bash
sudo /usr/sbin/apache2ctl configtest
sudo systemctl reload apache2
```

## 6. Verificação

```bash
pm2 list
ss -ltnp | grep -E ':4001|:4002|:5432|:6379'
curl -f http://127.0.0.1:4001/api/health
curl -I http://127.0.0.1:4002/arqueia/login
curl -I https://cp2b.unicamp.br/arqueia/login
```

As portas 4001/4002/5432/6379 devem aceitar somente loopback. Confirme também login por e-mail `@unicamp.br`, logout, permissões, criação e conflito de reserva.

## Deploy recorrente

```bash
cd /data/arqueia/repo
bash infrastructure/scripts/backup-vm.sh
bash infrastructure/scripts/deploy-vm.sh
```

Promova `dev -> homolog -> prod`. O script interrompe o deploy se build, migração ou health check falharem.

## Rollback

1. Anote o commit em produção antes de cada deploy: `git rev-parse HEAD`.
2. Em falha de aplicação, volte ao commit conhecido, reinstale/build e recarregue o PM2.
3. Migrações já aplicadas não são revertidas automaticamente. Prefira código retrocompatível e correção adiante.
4. Restaure o banco apenas em incidente de dados, com API e worker parados e seguindo `BACKUP_RESTORE_RUNBOOK.md`.

```bash
cd /data/arqueia/repo
git switch --detach COMMIT_CONHECIDO
npm ci
set -a
. ./.env
set +a
NEXT_PUBLIC_BASE_PATH=/arqueia npm run build
pm2 startOrReload infrastructure/pm2/ecosystem.config.js --update-env
```
