# Plano — Boas práticas de laboratório no Arqueia

> Pedido da coordenação: levar ao Arqueia o *Guia de Boas Práticas Laboratoriais* (Gerência
> Técnica dos LIMs, HC-FMUSP, 2015) e as orientações de segurança, para alunos e visitantes,
> no celular e no desktop.

## Decisões

- **Resumo próprio, não cópia.** O PDF é do HC-FMUSP e não traz licença de redistribuição.
  O Arqueia não o hospeda: o botão "Baixar o guia completo" aponta para o endereço oficial da
  USP, e o conteúdo exibido é um checklist escrito para o CP2b, **com a fonte citada** em toda
  tela que o mostra.
- **Telefones certos para o CP2b.** O guia original lista telefones de São Paulo (CEATOX,
  SESMT e bombeiros da FMUSP). Numa emergência em Campinas, levariam a pessoa a ligar para o
  lugar errado, então não aparecem. No lugar deles:
  - os contatos da Unicamp informados pela coordenação: Central de Segurança (SVC/VIDAS),
    CIATox Campinas, Pronto-Socorro do HC e Botão de Pânico;
  - os números nacionais 192, 193 e 190.

  Um teste falha se algum telefone da FMUSP voltar.
- **Concentrações dependem do POP.** O guia cita hipoclorito a 5%. A concentração certa
  depende do uso, então o resumo remete ao POP do laboratório (um teste impede fixar o número).
  Tempos de autoclave e estufa e o álcool 70% são padrão e ficam.
- **Incompatibilidades: seleção.** O guia traz uma tabela longa. O app mostra uma seleção com
  as combinações comuns num laboratório de biogás e bioprodutos (metano, H₂S, amônia, ácidos,
  oxidantes), com busca sem acento, e aponta a tabela completa no PDF.
- **Público, sem login.** Quem ainda não tem conta também precisa das regras antes de entrar.
- **Item próprio do menu, fora do Guia de Uso.** A primeira versão era a aba 9 do Guia de Uso.
  A coordenação pediu que fosse um item da navegação lateral: segurança é consulta do dia a dia,
  não manual do sistema. Logado, o item **Boas Práticas** ("Segurança no laboratório") abre
  `/seguranca`, com o shell, para todos os papéis. Fica logo antes do Guia de Uso.

## Onde aparece

| Lugar | O quê |
|---|---|
| `/boas-praticas` | página pública (em `PUBLIC_PATHS`), com Informar e Ver agenda no topo |
| Tela de login | terceiro atalho "Boas práticas", abaixo de Ver agenda e Informar |
| Menu lateral (logado) | item **Boas Práticas**, que abre `/seguranca` com o shell; no celular, aparece em **Mais** |
| Agenda pública e formulário de informes | link no rodapé |

## Conteúdo (um só módulo: `components/good-practices/good-practices-content.ts`)

1. **Antes de entrar** e **Durante o trabalho**: sempre abertos.
2. **Em caso de acidente**: sempre aberto, em destaque.
   - Olhos, corpo, derramamento, fogo e intoxicação.
   - Contatos da Unicamp com links `tel:`, os números nacionais e "Avisar a coordenação"
     (Informar).
3. Seções recolhíveis (o sumário abre a seção para onde aponta):
   - riscos, com as cores do mapa de risco (NR-5), e classes e níveis biológicos;
   - EPI, luvas e EPC;
   - limpeza, desinfecção e esterilização;
   - descarte;
   - incompatibilidades químicas.

## Manutenção

- `UNICAMP_EMERGENCY_CONTACTS` registra a data da revisão (`EMERGENCY_CONTACTS_REVIEWED_AT`),
  que aparece na tela. Revise quando um número mudar.
- **Pendente de confirmação:** as fontes da coordenação dão números diferentes para o
  Pronto-Socorro do HC: (19) 3521-8770/8771/8772 e (19) 3521-8783. A tela mostra 3521-8770 e
  3521-8783 até a confirmação.

## Testes

- Conteúdo:
  - fonte e URL oficial;
  - nenhum telefone da FMUSP;
  - contatos discáveis;
  - hipoclorito sem número fixo;
  - cores NR-5;
  - busca sem acento.
- Componente:
  - essenciais e acidente visíveis;
  - download externo em nova aba;
  - o sumário abre a seção;
  - busca;
  - nível de título dentro do shell.
- Navegação: o item aparece para todos os papéis, antes do Guia de Uso, com o laboratório ativo.
- Telas:
  - página pública;
  - `/seguranca`: item ativo no menu e Informar no laboratório da URL; sem sessão, volta ao login;
  - atalho no login e card no Mais.
- `externalUrl()` marca link externo deliberado, aceito pela varredura de `basePath`. A
  varredura ganhou um caso que prova isso.
- e2e (`tests/e2e/good-practices.spec.ts`):
  - do login até `/boas-praticas` sem sessão, com o contato da Central de Segurança;
  - logado, do menu (desktop) ou do Mais (celular) até `/seguranca`.
