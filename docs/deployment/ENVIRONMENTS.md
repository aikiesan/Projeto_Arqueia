# Ambientes — Arqueia

Nada vai a produção sem passar por homologação.

| Ambiente | Execução | Banco | URL |
|---|---|---|---|
| dev | Docker/local | `arqueia` local | `http://localhost:4002` |
| homolog | VM ou instância/portas isoladas | `arqueia_homolog` | endereço interno definido pelo TI |
| prod | VM CP2B, PM2 | `arqueia` | `https://cp2b.unicamp.br/arqueia` |

## Regras

- Credenciais, segredos, bancos e Redis distintos por ambiente; somente `.env.example` é versionado.
- Migrações seguem `dev -> homolog -> prod`. Migração aplicada nunca é editada: crie outra.
- Seeds de demonstração são proibidos em produção.
- O build de Web deve usar `NEXT_PUBLIC_BASE_PATH=/arqueia` em homologação equivalente e produção.
- Produção usa `/data/arqueia` para repositório, logs e backups; o banco usa o tablespace `arqueia_data`.
- Backup precede deploy; restauração é testada periodicamente em ambiente isolado.
