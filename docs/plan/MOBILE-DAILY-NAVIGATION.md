# Plano — Hub móvel de navegação diária

## Objetivo

Corrigir o destino inexistente `/mais` da navegação inferior e oferecer, em celular,
um ponto único e previsível para acessar módulos secundários, trocar o laboratório
ativo e abrir recursos da conta sem depender da barra lateral desktop.

## Escopo

- criar a rota autenticada `/mais`;
- respeitar `?laboratory=<uuid>` quando o laboratório estiver entre os retornados
  pelo servidor;
- listar somente módulos já presentes em `WorkspacePresentation.moduleNavigation`;
- destacar Equipamentos, Usuários, Gestão e Guia quando disponíveis;
- expor Perfil e encerramento de sessão no bloco de conta;
- permitir troca de laboratório por links explícitos, sem inferência por código ou
  nome fixo;
- usar layout mobile-first, alvos de toque de pelo menos 44 px, foco visível e
  nomes acessíveis;
- manter a página útil em desktop, sem duplicar a barra lateral como fonte de
  autorização.

## Contrato de entrada

- `GET /api/session`: principal autenticado;
- `GET /api/laboratories`: laboratórios já autorizados pelo servidor;
- query opcional `laboratory`;
- `createWorkspacePresentation`: fonte compartilhada da navegação visível.

## Contrato de saída

- shell com `activeModuleHref="/mais"`;
- cartões de navegação derivados dos itens compartilhados, sem redefinir papéis;
- links de laboratório no formato `/mais?laboratory=<uuid>`;
- estado de carregamento e falha recuperável;
- nenhuma mutação de domínio, contrato compartilhado, API, banco ou migração.

## Critérios de aceite

1. “Mais” na navegação inferior abre uma página existente e fica marcado como atual.
2. Usuário comum não recebe atalhos que não existam em sua apresentação autorizada.
3. Usuário com capacidades adicionais vê os módulos correspondentes.
4. A troca de laboratório atualiza o contexto pela URL e não usa um código fixo.
5. Guia e Perfil permanecem acessíveis no mobile.
6. Todos os controles interativos possuem nome acessível, foco visível e alvo de
   toque mínimo de 44 px.
7. Há testes em 390 px e 1440 px, além de estados de carregamento e erro.
8. Typecheck, lint, testes e build permanecem verdes.

## Fora de escopo

- novas permissões ou decisões de autorização no cliente;
- central de notificações sem contrato de backend;
- mudanças em autenticação, estoque, reservas, contratos ou persistência;
- mapas, geolocalização ou plantas interativas.
