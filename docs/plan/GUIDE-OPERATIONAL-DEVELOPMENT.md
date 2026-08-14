# Plano — Remoção da Busca Incompleta e Guia Operacional Interativo do Arqueia (/guia)

## 1. Objetivo

1. **Remover a barra de busca não funcional** da TopBar no pacote `@arqueia/ui` (props, CSS, layout grid e testes), simplificando a interface e atualizando a documentação arquitetural.
2. **Criar o Guia Operacional Passo a Passo em [`/guia`](file:///A:/Projeto_Arqueia/apps/web/app/guia)**, fornecendo documentação técnica e de uso da plataforma Arqueia no laboratório CP2b, com versionamento editorial, navegação por âncoras persistentes e acessibilidade em desktop e mobile.

---

## 2. Ajustes Obrigatórios e Invariantes

### A. Remoção da Busca (`@arqueia/ui`)
- Remover a prop `searchLabel` de `WorkspaceShellProps`.
- Remover o elemento `<button className="arqueia-search">` e suas regras CSS em `workspace-shell.css` / `styles.css`.
- Ajustar as colunas da grid da TopBar nos breakpoints mobile e desktop.
- Atualizar os testes em `@arqueia/ui` e a documentação em `docs/architecture/ARCHITECTURE.md`.

### B. Novo Ícone de Documentação (`@arqueia/ui`)
- Adicionar o ícone `guia` em `packages/ui/src/icons.tsx` e no tipo `ArqueiaIconName`, com teste unitário.

### C. Acessibilidade Mobile
- Como o sidebar é exibido apenas em resoluções $\ge 960\text{px}$, o acesso ao `/guia` no mobile será fornecido no menu suspenso do perfil de usuário (`.arqueia-user-dropdown`) e no sidebar desktop.

### D. Precisão Factual do Conteúdo
- **Versão Editorial**: Cabeçalho fixo com Versão do Guia, Data da Última Revisão, Responsável Editorial e Compatibilidade (Arqueia v1.0).
- **Estoque & Ledger**: Esclarecer que os saldos de lotes são derivados do livro-razão de movimentações (`stock_movements`) e que o lote possui o campo `manufacturer` (fabricante).
- **Recorrência de Reservas**: Explicar a resolução parcial de conflitos (agendamento das datas livres e relatório explícito de conflitos).
- **Funcionalidades Planejadas**: Identificar claramente a leitura por câmera de QR Code (`/qr`) como recurso em desenvolvimento.
- **Linguagem**: Utilizar termos amigáveis para usuários (*Entrada*, *Retirada*, *Ajuste*, *Campos sensíveis ocultados*) mantendo os equivalentes técnicos em seção específica.

---

## 3. Checkpoints de Execução

### G0 — Congelar o Plano
- Salvar este plano em `docs/plan/GUIDE-OPERATIONAL-DEVELOPMENT.md` e atualizar o artefato `implementation_plan.md`.

### G1 — Remover a Busca Incompleta
- Limpar `WorkspaceShellProps`, componente, estilos CSS e testes de UI.
- Atualizar `docs/architecture/ARCHITECTURE.md`.

### G2 — Ícone e Navegação
- Adicionar o ícone `guia` em `packages/ui/src/icons.tsx`.
- Adicionar o item no menu lateral desktop e no dropdown de perfil (acesso mobile).

### G3 — Estrutura e Rota `/guia`
- Implementar `apps/web/app/guia/page.tsx` com `<Suspense>`, metadata e wrapper autenticado.
- Criar `guide-page-client.tsx` com índice navegável por âncoras (`/guia#agenda`, `/guia#estoque`, etc.).

### G4 — Conteúdo Comprovado
- Redigir o conteúdo completo baseado nos comportamentos reais verificados no código do monorepo.

### G5 — Acessibilidade e Responsividade
- Testar navegação por teclado (`Tab`/`Enter`), leitor de tela, visualização em dispositivos móveis e suporte a temas.

### G6 — Verificação Completa
- Testes unitários (`@arqueia/ui`, `@arqueia/web`), `npm run lint`, `npm run typecheck`, `npm run build` e `npm test`.

---

## 4. Critérios de Aceite

- Nenhuma referência a `.arqueia-search` permanece no código.
- A rota `/guia` é alcançável em telas desktop e dispositivos móveis.
- O manual contém versionamento editorial visível.
- 100% dos testes e verificações de linter/typecheck aprovados.
