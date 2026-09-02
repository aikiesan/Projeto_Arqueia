# Checklist de Aceitação e Validação em Produção (Production Deployment Acceptance Checklist)

> **Classificação**: Documento Operacional de Engenharia e Infraestrutura
> **Controlador Institucional**: Universidade Estadual de Campinas — UNICAMP (CNPJ: 46.068.425/0001-33)
> **Finalidade**: Verificação prática pós-implantação na VM Debian institucional antes do go-live operacional.

---

## 1. Portões de Aceitação de Software (Status no Repositório)

```
[PASSOS DE DESENVOLVIMENTO & VERIFICAÇÃO]
├── [✅] Testes Automatizados Reais (348/348 testes passando sem mocks em regras de negócio)
├── [✅] Typecheck TypeScript Estrito (0 erros em monorepo)
├── [✅] Análise de Linter ESLint 9 (0 erros / 0 warnings)
├── [✅] Build de Produção (Compilação limpa de packages, NestJS API, Next.js Web e Worker)
├── [✅] Auditoria de Dependências (npm audit = 0 vulnerabilidades)
└── [✅] Dossiê de Evidências LGPD & Minuta RIPD Gerados
      ↓
[PORTÃO DE INFRAESTRUTURA & IMPLANTAÇÃO NA VM]
└── [⏳] Validação de Aceitação na VM de Produção (Itens abaixo)
      ↓
[PORTÃO DE GOVERNANÇA INSTITUCIONAL]
└── [⏳] Registro e Homologação formal no Sistema Privacidade UNICAMP
```

---

## 2. Checklist Operacional de Aceitação na VM de Produção

Execute os seguintes comandos e verificações diretamente no ambiente da VM Debian:

| Item de Verificação | Comando / Procedimento de Teste | Resultado Esperado | Status na VM |
| :--- | :--- | :--- | :---: |
| **1. Apache VHost Carregado** | `apache2ctl -S \| grep arqueia` | VHost `arqueia.cp2b.unicamp.br` ativo nas portas 80 e 443 | ⏳ A testar na VM |
| **2. Redirecionamento HTTP $\rightarrow$ HTTPS** | `curl -I http://arqueia.cp2b.unicamp.br` | Retorno `HTTP/1.1 301 Moved Permanently` para `https://...` | ⏳ A testar na VM |
| **3. Terminação HTTPS/TLS** | `curl -Iv https://arqueia.cp2b.unicamp.br` | TLS 1.2 ou 1.3 negociado com certificado válido emitido | ⏳ A testar na VM |
| **4. Cabeçalhos de Segurança** | `curl -I https://arqueia.cp2b.unicamp.br` | Presença de `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` | ⏳ A testar na VM |
| **5. Roteamento Unificado Next.js BFF** | `curl -I https://arqueia.cp2b.unicamp.br/api/session` | Resposta processada pelo Next.js BFF (retorno 401 unauthenticated), sem shadowing de rotas | ⏳ A testar na VM |
| **6. Teste de IP Spoofing (`X-Forwarded-For`)** | `curl -H "X-Forwarded-For: 1.2.3.4" https://arqueia.cp2b.unicamp.br/api/session/login` | O Apache normaliza o cabeçalho via `mod_remoteip` com o IP real da conexão | ⏳ A testar na VM |
| **7. Bind da API NestJS** | `ss -tulpn \| grep :4001` | Escutando exclusivamente em `127.0.0.1:4001` (nunca `0.0.0.0`) | ⏳ A testar na VM |
| **8. Bind do Next.js Web** | `ss -tulpn \| grep :4002` | Escutando exclusivamente em `127.0.0.1:4002` (nunca `0.0.0.0`) | ⏳ A testar na VM |
| **9. Bind do PostgreSQL** | `ss -tulpn \| grep :5432` | Escutando exclusivamente em `127.0.0.1:5432` ou socket Unix | ⏳ A testar na VM |
| **10. Bind do Redis** | `ss -tulpn \| grep :6379` | Escutando exclusivamente em `127.0.0.1:6379` ou socket Unix | ⏳ A testar na VM |
| **11. Portas Externas e Firewall** | `sudo ufw status` ou `sudo iptables -L -n` | Apenas portas 80, 443 e 22 (SSH restrito) abertas externamente | ⏳ A testar na VM |
| **12. Contagem de Processos PM2** | `pm2 list` | Exatamente 1 instância de cada serviço (`api`, `web`, `worker`) em estado `online` | ⏳ A testar na VM |
| **13. Ambiente `NODE_ENV`** | `pm2 env 0 \| grep NODE_ENV` | `NODE_ENV=production` em todas as instâncias | ⏳ A testar na VM |
| **14. Permissões de Arquivo `.env`** | `ls -la /opt/arqueia/.env` | Permissões restritas `600` (leitura apenas pelo usuário de serviço) | ⏳ A testar na VM |
| **15. Rotação de Logs** | `logrotate -d /etc/logrotate.d/arqueia` | Configuração de logrotate sintaticamente válida para logs do PM2/Apache | ⏳ A testar na VM |
| **16. Execução de Backup do Banco** | `/opt/arqueia/scripts/backup-db.sh` | Dump gerado com sucesso em `/var/backups/arqueia/` sem erros | ⏳ A testar na VM |
| **17. Teste de Restauração (Drill)** | `pg_restore --dry-run <dump>` | Dump legível e íntegro sem corrupção | ⏳ A testar na VM |
| **18. Health Check Interno da API** | `curl -f http://127.0.0.1:4001/api/health` | Retorno `HTTP 200 {"status":"ok"}` | ⏳ A testar na VM |

---

## 3. Critério de Aprovação da Infraestrutura

A passagem do ambiente para homologação institucional requer que **100% dos 18 itens da tabela acima sejam marcados como verificados** pelo administrador de sistemas da infraestrutura UNICAMP.
