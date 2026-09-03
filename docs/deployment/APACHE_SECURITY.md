# Segurança do Apache e do proxy institucional

> Configuração de referência: `infrastructure/proxy/cp2b-arqueia-path.apache.conf`

## Fronteiras de rede

O proxy institucional da Unicamp recebe HTTPS público e encaminha a requisição à porta 80 da VM. O Apache2 local preserva o site CP2B e encaminha o prefixo `/arqueia` ao Next.js/BFF em `127.0.0.1:4002`.

```text
Navegador --HTTPS--> proxy Unicamp --HTTP interno--> Apache2 :80
                                                   -> Next/BFF :4002
                                                        -> API :4001
```

A API NestJS, PostgreSQL e Redis não devem ser expostos publicamente. Confirme os binds em loopback e as regras de firewall com o TI responsável.

## Invariantes de roteamento

- Todo `/arqueia`, inclusive `/arqueia/api/*`, passa pelo Next.js/BFF.
- O Apache nunca encaminha `/arqueia/api/*` diretamente à API NestJS.
- O bloco `/arqueia` deve vir antes do fallback da SPA do CP2B e de regras genéricas de `/api`.
- A SPA existente precisa excluir `^/arqueia` de sua regra de reescrita.
- `ProxyPreserveHost On` deve permanecer ativo no VirtualHost.

## Cabeçalhos encaminhados

O bloco configura:

```apache
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Host "cp2b.unicamp.br"
RequestHeader set X-Forwarded-Prefix "/arqueia"
```

O valor `https` representa o protocolo visto pelo usuário na fronteira institucional. A lista de proxies confiáveis e a normalização de `X-Forwarded-For` devem usar apenas os endereços fornecidos pela equipe de rede da Unicamp; não declare toda a Internet como proxy confiável.

## Cabeçalhos de resposta

Preserve no VirtualHost as políticas já adotadas pelo CP2B, no mínimo `X-Content-Type-Options: nosniff`, `Referrer-Policy` e proteção contra framing. HSTS deve ser definido no ponto que efetivamente termina TLS — o proxy institucional — para evitar uma garantia incorreta no salto HTTP interno.

## Validação segura

```bash
sudo /usr/sbin/apache2ctl configtest
sudo systemctl reload apache2
curl -I http://127.0.0.1:4002/arqueia/login
curl -I https://cp2b.unicamp.br/arqueia/login
```

Não instalar Certbot nem criar VirtualHost `*:443` para o Arqueia: os certificados continuam sob gestão da infraestrutura institucional.
