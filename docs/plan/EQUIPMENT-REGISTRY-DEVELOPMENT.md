# Plano — Cadastro operacional de equipamentos

## Objetivo

Transformar `/equipamentos` em um cadastro real e escalável para consulta, inclusão e atualização manual de ativos físicos, usando contratos compartilhados, validação estrita, RBAC e auditoria. Docker é somente o ambiente local; aplicação, migrações e build permanecem nativos para a VM.

## Entrega inicial

- Busca por nome/código, filtro por status e paginação por cursor.
- Cadastro e edição de modelo, localização, identificação patrimonial, série, status, política de reserva e observações.
- Detalhes legíveis por equipamento e estados vazio/erro/carregamento.
- Escritas via BFF com cookie HttpOnly, origem confiável e schemas Zod estritos.
- Persistência PostgreSQL e auditoria append-only já implementadas no módulo `equipment`.
- Testes de UI/API e smoke test no Docker Desktop/Postgres 16.

## Fora desta entrega

- Importação automática de todas as linhas da planilha.
- Documentos, fotos, calibrações, manutenções e QR físico.
- Exclusão; quando implementada, será arquivamento.

## Aceite

Um administrador/técnico autorizado consegue localizar, cadastrar e editar equipamentos reais; entradas inválidas são rejeitadas; usuário sem permissão é bloqueado no servidor; alterações sobrevivem ao restart dos containers; `npm run build` continua independente de Docker.
