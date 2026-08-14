# ADR-002 — Co-hospedagem no cp2b com subdomínio próprio

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto
Já existe uma VM servindo cp2b.unicamp.br (Apache2, certificado Let's Encrypt funcionando, carga baixa), ampliada para 16 GB/8–12 CPU/100+ GB. Arqueia é um sistema novo (operação de laboratório do NIPE), distinto da plataforma de biogás do cp2b.

## Decisão
Hospedar Arqueia na **mesma VM**, sob **subdomínio próprio** (ex.: `arqueia.cp2b.unicamp.br`):
- Novo VirtualHost Apache2 dedicado.
- Certificado TLS **expandido** para o subdomínio (`certbot --apache --expand`), sem novo certificado.
- Banco de dados, processos PM2 e portas **totalmente separados** dos do cp2b (api 4001, web 4002; cp2b usa 3001).

## Consequências
- (+) Um certificado, um proxy, um fluxo de deploy; menor custo e manutenção.
- (+) A carga do cp2b é baixa; recursos ampliados comportam ambos.
- (−) Compartilham VM: uma falha de host afeta os dois. Mitigar com monitoramento e limites de recurso (systemd/PM2).
- **Gatilho para revisão:** se os reagentes controlados exigirem isolamento de rede/dados por conformidade, migrar o módulo/serviço para VM separada. A separação é possível sem retrabalho de código (bancos e processos já são isolados).

## Alternativas consideradas
- **VM separada + certificado próprio:** mais isolamento, porém overhead injustificado para a carga atual. Mantido como caminho de evolução para controlados.

## Pendência de verificação
Confirmar na VM se o proxy na frente é **Apache2** (declarado pela equipe) ou nginx (usado no material de referência do cp2b): `apache2 -v` e `nginx -v`. Os configs de proxy dependem disso.
