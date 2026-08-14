# Checklist de Regressão Visual — WorkspaceShell & Componentes Compartilhados

Este documento define os critérios de verificação e inspeção visual obrigatórios para garantir que alterações na UI não introduzam desalinhamentos, quebras em viewports móbiles ou comportamentos inconsistentes.

---

## 1. WorkspaceShell (Layout & Moldura)

- [ ] **Header Responsivo (1440px):**
  - Logo e nome da aplicação visíveis à esquerda sem estritamento.
  - Indicador do laboratório ativo (`currentContext`) com destaque legível.
  - Trilho de navegação lateral/superior perfeitamente alinhado.
- [ ] **Barra de Navegação Mobile (390px):**
  - Barra de atalhos inferior fixa (Início, Agenda, Estoque, Mais).
  - Ícone de leitor QR visível e acessível.
  - Ausência de transbordamento horizontal (*horizontal scrollbar*).
- [ ] **Avatar e Menu de Usuário:**
  - Iniciais do usuário geradas corretamente (2 letras max).
  - Botão "Sair" com contraste e ação de encerramento.

---

## 2. Componentes de Módulos (Gestão, Estoque, Equipamentos)

- [ ] **Modais e Diálogos (`<dialog>`):**
  - Fundo escurecido (backdrop) cobrindo toda a tela.
  - Foco preso dentro do modal e fechamento no botão `✕` ou tecla `Escape`.
- [ ] **Tabelas Operacionais:**
  - Cabeçalhos alinhados com os dados.
  - Suporte a rolagem horizontal interna em telas pequenas sem quebrar a moldura externa.
- [ ] **Cards e Indicadores (KPIs):**
  - Bordas coloridas por tom (`brand`, `neutral`, `warning`, `pending`).
  - Textos com contraste WCAG 2.2 AA.

---

## 3. Matriz de Dispositivos e Viewports de Teste

| Viewport | Resolução | Alvo Primário |
|---|---|---|
| Mobile Small | 390 × 844 px | iPhone 12/13/14 / Android padrão |
| Tablet | 768 × 1024 px | iPad Mini / Galaxy Tab |
| Desktop | 1440 × 900 px | Display Desktop padrão / Notebook |
