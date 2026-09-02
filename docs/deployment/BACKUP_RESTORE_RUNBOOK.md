# Procedimentos de Backup e Restauração (Backup & Restore Runbook)

> **Classificação**: Documento Operacional e de Continuidade de Negócio
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Princípio de Segurança**: Garantia de Disponibilidade, Integridade e Recuperabilidade (Art. 6º, VII e VIII LGPD).

---

## 1. Política de Backup

| Componente | Frequência | Tipo de Backup | Retenção | Destino |
| :--- | :--- | :--- | :--- | :--- |
| **Banco de Dados PostgreSQL (`arqueia`)** | Diário (Madrugada) | Dump Completo Lógico (`pg_dump -Fc`) | 30 dias locais + retenção em storage seguro | Disco local `/var/backups/arqueia` + Storage Seguro Unicamp |
| **Arquivos de Configuração (`.env`, Apache)** | Semanal ou a cada alteração | Snapshot de arquivos criptografado | Versão corrente + 5 versões históricas | Repositório de infraestrutura seguro |
| **Trilha de Auditoria Histórica** | Mensal | Export comprimido append-only | Conforme Tabela de Temporalidade institucional da UNICAMP | Cold storage institucional imutável |

---

## 2. Script de Execução de Backup Automatizado

Localização recomendada na VM: `/opt/arqueia/scripts/backup-db.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/arqueia"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/arqueia_db_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date)] Iniciando backup do banco de dados Arqueia..."
pg_dump -U arqueia -d arqueia -h 127.0.0.1 -Fc -f "${BACKUP_FILE}"

echo "[$(date)] Backup concluído com sucesso: ${BACKUP_FILE}"
# Remove backups com mais de 30 dias no disco local
find "${BACKUP_DIR}" -type f -name "arqueia_db_*.dump" -mtime +30 -delete
```

---

## 3. Procedimento de Restauração (Disaster Recovery)

### Pré-requisitos
- Acesso SSH administrativo à VM Debian.
- Serviço da API parado para evitar escritas concorrentes durante a restauração:
  ```bash
  pm2 stop arqueia-api arqueia-worker
  ```

### Passo a Passo de Restauração

1. **Identificar o arquivo de backup a ser restaurado**:
   ```bash
   ls -la /var/backups/arqueia/
   ```
2. **Restaurar o banco de dados**:
   ```bash
   pg_restore -U arqueia -d arqueia -h 127.0.0.1 --clean --if-exists /var/backups/arqueia/arqueia_db_YYYYMMDD_HHMMSS.dump
   ```
3. **Executar migrações pendentes (se houver)**:
   ```bash
   cd /opt/arqueia
   npm run db:migrate
   ```
4. **Reiniciar as aplicações**:
   ```bash
   pm2 restart ecosystem.config.js
   ```
5. **Validar integridade dos serviços**:
   - Testar endpoint de saúde: `curl -I http://127.0.0.1:4001/api/health`
   - Verificar logs do PM2: `pm2 logs --lines 50`

---

## 4. Teste Periódico de Restauração (Drill de Recuperação)

Recomenda-se a realização semestral de um teste de restauração em ambiente isolado (staging/homologação) para validar a integridade dos arquivos de dump e o tempo de recuperação objetivo (RTO < 2 horas, RPO < 24 horas).
