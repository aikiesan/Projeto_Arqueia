# Correção dos scripts de implantação Debian

## Escopo

Garantir que os scripts de setup e deploy da VM sejam armazenados e materializados com finais de linha LF, preservando as melhorias já preparadas de health check e configuração do Apache.

## Contrato de entrada e saída

- Entrada: checkout do repositório em Windows ou Linux.
- Saída: `setup-vm.sh` e `deploy-vm.sh` interpretáveis pelo Bash no Debian.
- Invariante: arquivos `*.sh` usam LF independentemente da configuração global do Git.

## Critérios de aceite

- `git ls-files --eol` reporta `i/lf` e `w/lf` para os dois scripts.
- `bash -n infrastructure/scripts/setup-vm.sh` passa.
- `bash -n infrastructure/scripts/deploy-vm.sh` passa.
- Nenhuma aplicação, contrato de domínio ou migração é alterada neste PR.

## Risco e rollback

Risco baixo, limitado à automação de implantação. O rollback consiste em reverter o commit; nenhuma alteração é executada na VM por este PR.
