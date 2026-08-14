# Ambientes — Arqueia

Três ambientes separados. Nada vai a produção sem passar por homologação.

| Ambiente | Onde | Banco | URL | Uso |
|---|---|---|---|---|
| **dev** | máquina do desenvolvedor | Postgres/Redis locais | localhost:4002 | desenvolvimento e testes locais |
| **homolog** | VM (instância separada ou porta/DB distintos) | DB `arqueia_homolog` | ex.: `homolog.arqueia.cp2b.unicamp.br` ou porta interna | validação antes de produção |
| **prod** | VM | DB `arqueia` | `arqueia.cp2b.unicamp.br` | produção |

## Regras
- Credenciais, segredos e URLs **distintos** por ambiente. Só `.env.example` é versionado.
- Migrações são aplicadas em dev → homolog → prod, nesta ordem. Migração já aplicada em homolog/prod nunca é editada; cria-se uma nova.
- Seeds de exemplo só em dev/homolog.
- Versões de Node/Postgres/Redis documentadas e iguais entre homolog e prod (paridade). Node fixado em `.nvmrc`.
- Backups automáticos em prod (e, idealmente, homolog); restauração testada periodicamente.
