# @arqueia/ui

Design system compartilhado. Dois padrões de layout coexistem:

- **Mobile-first (operação):** navegação inferior (Início, Agenda, Estoque, Mais), botão central destacado de QR Code, fluxos curtos para uso com uma mão, digitação manual como alternativa à câmera. PWA instalável.
- **Desktop-first (gestão, inspiração Slack):** barra lateral de laboratórios/unidades, segunda barra de módulos/filtros, área central, painel contextual à direita, busca global e menu de comandos.

Componentes são agnósticos de dados e recebem somente props de apresentação. A aplicação
`web` é responsável por adaptar os tipos de `@arqueia/contracts` para essas props; o pacote
de UI não decide autorização nem contém regras de domínio.
