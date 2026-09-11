# Backup e restauração

> Finalidade: disponibilidade, integridade e recuperabilidade dos dados operacionais e da trilha de auditoria.

## Política mínima

| Componente | Frequência | Retenção local | Destino |
|---|---|---:|---|
| PostgreSQL `arqueia` | diária, antes de deploy | 30 dias | `/data/arqueia/backups` + cópia institucional segura |
| `.env` e configuração Apache | após alteração | 5 versões | cofre/backup institucional criptografado |
| auditoria | conforme temporalidade aprovada | definida pela coordenação | storage institucional protegido |

O backup no mesmo disco não cobre perda da VM. O responsável de TI deve copiar e testar os dumps em armazenamento institucional separado.

## Criar e verificar backup

O script versionado usa `DATABASE_URL` do ambiente ou carrega `/data/arqueia/repo/.env`, aplica `umask 077`, gera SHA-256 e verifica o catálogo do dump.

```bash
cd /data/arqueia/repo
bash infrastructure/scripts/backup-vm.sh
ls -lh /data/arqueia/backups
```

Agendamento sugerido pelo TI, fora do repositório:

```cron
15 2 * * * cd /data/arqueia/repo && bash infrastructure/scripts/backup-vm.sh >>/data/arqueia/logs/backup.log 2>&1
```

## Restauração

Restauração é destrutiva. Faça primeiro em homologação e confirme o arquivo e seu checksum.

```bash
cd /data/arqueia/backups
sha256sum --check arqueia_YYYYMMDD_HHMMSS.dump.sha256
pg_restore --list arqueia_YYYYMMDD_HHMMSS.dump >/dev/null
```

Na janela autorizada de recuperação:

```bash
pm2 stop arqueia-api arqueia-worker
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner \
  /data/arqueia/backups/arqueia_YYYYMMDD_HHMMSS.dump
cd /data/arqueia/repo
npm run db:migrate
pm2 startOrRestart infrastructure/pm2/ecosystem.config.js
curl -f http://127.0.0.1:4001/api/health
```

Registre responsável, motivo, backup utilizado, horário, resultado e validações. Execute um drill semestral em homologação; metas iniciais: RPO de até 24 horas e RTO de até 2 horas, sujeitas à aprovação institucional.
