# Checklist de homologação e produção

> Execute primeiro em homologação e registre data, responsável e evidência de cada item.

## Software

| Verificação | Comando/evidência | Esperado |
|---|---|---|
| CI | testes, lint, typecheck e build | todos aprovados |
| Build por prefixo | `NEXT_PUBLIC_BASE_PATH=/arqueia npm run build` | sucesso |
| Migrações | `npm run db:migrate` | sem erro e sem editar migração aplicada |
| Segredos | GitGuardian/secret scan | nenhum segredo real versionado |
| Identidade | login com nome e e-mail institucional | somente domínio Unicamp aceito |
| Autorização | testes papel × laboratório | decisão sempre no servidor |

## VM e rede

| Verificação | Comando/evidência | Esperado |
|---|---|---|
| Apache | `sudo /usr/sbin/apache2ctl configtest` | `Syntax OK` |
| URL pública | `curl -I https://cp2b.unicamp.br/arqueia/login` | resposta do Next.js |
| Site atual | navegar nas páginas existentes do CP2B | nenhuma regressão |
| BFF | testar login/logout via `/arqueia/api/session/*` | cookie `HttpOnly`, caminho `/arqueia` |
| API | `ss -ltnp | grep :4001` | somente loopback |
| Web | `ss -ltnp | grep :4002` | somente loopback |
| PostgreSQL | `ss -ltnp | grep :5432` | socket local/loopback |
| Redis | `ss -ltnp | grep :6379` | socket local/loopback |
| PM2 | `pm2 list` | `arqueia-api`, `arqueia-web`, `arqueia-worker` online |
| Reinício | reboot controlado + `pm2 list` | processos restaurados |

## Dados e operação

| Verificação | Comando/evidência | Esperado |
|---|---|---|
| Tablespace | consulta `pg_tablespace` | `arqueia_data` em `/data/arqueia/postgresql` |
| `.env` | `stat -c '%a %U %G' /data/arqueia/repo/.env` | `600`, usuário de serviço |
| Backup | `bash infrastructure/scripts/backup-vm.sh` | dump, checksum e catálogo válidos |
| Cópia externa | evidência do storage institucional | backup fora da VM |
| Restauração | drill em homologação | dados íntegros e serviço recuperado |
| Auditoria | criar/alterar reserva e consultar evento | ator, data, origem e mudança registrados |

## Fluxos funcionais mínimos

- Login e logout com e-mail institucional.
- Conta suspensa ou não autorizada não acessa o sistema.
- Usuário vê somente laboratórios permitidos.
- Criação, aprovação/recusa e conflito de reserva funcionam.
- Perfil exibe nome e e-mail corretos.
- Navegação pelo link/aba do CP2B permanece dentro de `/arqueia`.

## Aprovação

O go-live depende de todos os itens aplicáveis aprovados em homologação, backup confirmado e autorização operacional do gestor de TI e da coordenação do CP2B. O HTTPS/certificado continua sob responsabilidade do proxy institucional da Unicamp.
