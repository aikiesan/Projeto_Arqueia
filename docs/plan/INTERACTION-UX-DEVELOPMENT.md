# Plano — Camada de interação, movimento e edição operacional

## 1. Objetivo

Tornar o Arqueia rápido e previsível no uso diário: consultar deve ser fluido; alterar deve acontecer perto do dado, persistir pela API no PostgreSQL, produzir auditoria no backend e retornar confirmação inequívoca ao usuário.

Animação comunica mudança de estado. Ela não pode esconder latência, substituir confirmação do servidor nem atrasar uma tarefa operacional.

## 2. Decisões

- microinterações serão implementadas primeiro com CSS e React, sem dependência adicional;
- `prefers-reduced-motion` é obrigatório;
- alterações críticas continuam exigindo formulário/confirmação; alterações frequentes e reversíveis podem ser inline;
- a UI pode apresentar estado otimista, mas deve reverter se a API falhar;
- sucesso só é anunciado depois da resposta válida da API;
- mapas, geolocalização, plantas interativas e React Leaflet estão definitivamente fora do escopo do produto;
- localização operacional continuará textual e estruturada como laboratório → espaço → bancada → equipamento/lote.

## 3. Padrões de interação

1. **Consulta:** skeleton curto, transição de opacidade, filtros preservados na URL e vazio acionável.
2. **Edição inline:** valor → estado “salvando” → resposta validada → confirmação; em erro, rollback e foco no controle.
3. **Formulário:** validação próxima ao campo, resumo de erro, submit idempotente e prevenção de clique duplo.
4. **Modal:** foco inicial, `Escape`, focus trap, retorno do foco e fechamento bloqueado durante commit crítico.
5. **Feedback:** toast global com `aria-live`, mensagem local junto da ação e registro de erro recuperável.
6. **Listas:** animação apenas em inserção/remoção/ordenação, nunca em toda atualização de polling.
7. **Dados críticos:** mostrar ator, instante e consequência antes de confirmar retirada, ajuste, cancelamento ou permissão.

## 4. Checkpoints

### UX0 — Fundação

- provider global de feedback;
- tokens de duração/easing;
- estados `idle`, `saving`, `saved` e `error`;
- animações de entrada, hover, press, modal e toast;
- fallback completo para reduced motion.

### UX1 — Piloto em Equipamentos

- mudança inline de status para técnicos;
- PATCH parcial validado pelo contrato existente;
- atualização otimista, rollback e confirmação;
- edição completa permanece no modal;
- teste de persistência e falha.

### UX2 — Estoque

- retirada e ajuste em painel lateral contextual;
- prévia de saldo e unidade antes do commit;
- confirmação do movimento registrado no ledger;
- histórico atualizado sem recarregar a página inteira;
- nenhuma edição direta de saldo.

### UX3 — Agenda

- seleção direta de faixa no calendário;
- prévia de duração e conflito;
- criação/cancelamento com feedback local;
- animação de conflito sem deslocamento excessivo;
- timezone do laboratório em todos os rótulos.

### UX4 — Gestão e usuários

- filtros e período sincronizados com URL;
- painéis independentes para falhas parciais;
- detalhes de auditoria em drawer acessível;
- permissões editadas com resumo de impacto e reautenticação.

## 5. Critérios de aceite

- toda mutação visível corresponde a uma resposta persistida e validada;
- falha nunca deixa a tela indicando um estado que não existe no banco;
- ações destrutivas ou sensíveis não são otimistas;
- teclado, leitor de tela, zoom e reduced motion funcionam;
- nenhuma animação essencial excede 300 ms;
- nenhuma biblioteca ou interface de mapa é adicionada ao sistema;
- testes cobrem sucesso, erro, clique duplo e isolamento por laboratório.
