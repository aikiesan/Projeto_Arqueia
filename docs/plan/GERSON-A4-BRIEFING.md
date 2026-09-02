# Plano — Briefing impresso do Arqueia para o gestor técnico

## Objetivo

Produzir um documento HTML autônomo, em português, preparado para impressão em folha A4 retrato, para apresentar ao gestor técnico indicado do NIPE/Unicamp o escopo do Arqueia, as responsabilidades propostas, o procedimento institucional, os requisitos da VM e a sequência de homologação.

## Entrada

- Sistema interno do CP2B, hospedado em VM institucional com proxy e certificado existentes.
- Autenticação local por código único e senha.
- Cadastro mínimo pseudonimizado: código, login, hash de senha, categoria acadêmica, laboratório, status e reservas.
- Categorias: IC, Mestrado, Doutorado, Pós-doutorado e Pesquisador.
- Coordenação do CP2B como autoridade operacional de concessão e revogação de acessos.
- Gerson como indicação proposta para gestor técnico, sujeita a aceite e formalização.

## Saída

- `docs/presentation/ARQUEIA-BRIEFING-GERSON.html`.
- Arquivo sem fontes, scripts ou imagens externas.
- Layout dividido em páginas com quebras controladas para A4 retrato.
- Botão de impressão visível somente em tela.

## Critérios de aceite

1. O navegador reconhece `@page { size: A4 portrait; }`.
2. O botão de impressão não aparece no papel.
3. Cada seção principal possui quebra de página previsível.
4. O conteúdo distingue autoridade operacional, gestor técnico e Comitê Local de Privacidade.
5. O documento não descreve os dados como anônimos; usa a classificação pseudonimizada.
6. Senhas são descritas apenas como hashes, nunca como texto armazenado.
7. O documento lista decisões solicitadas ao Gerson e os próximos passos locais com Docker.
8. Nenhum segredo, credencial ou dado pessoal real é incluído.

## Verificação

- Conferência textual do HTML e dos estilos de impressão.
- Busca por dependências externas e segredos.
- Abertura do arquivo final no painel do Codex para inspeção pelo usuário.
