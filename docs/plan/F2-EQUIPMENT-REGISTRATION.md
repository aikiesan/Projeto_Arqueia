# Fase 2 — Cadastro mínimo de equipamentos

## Objetivo

Converter uma opção confirmada do catálogo em um equipamento operacional real, criando a base necessária para Agenda, Reservas e Bloqueios. Nenhum equipamento é criado automaticamente pelo seed.

## Escopo inicial

- Listar equipamentos ativos por laboratório.
- Cadastrar equipamento a partir de `CatalogOption(EQUIPMENT_MODEL|EQUIPMENT_TYPE)`.
- Vincular opcionalmente espaço, bancada e responsável.
- Definir código, patrimônio, número de série, status e política mínima de reserva.
- Editar os mesmos dados; exclusão física não faz parte do contrato.
- Auditar criação e edição na mesma transação.

## Política mínima de reserva

- duração máxima em minutos;
- treinamento obrigatório;
- aprovação técnica obrigatória;
- janela para liberação por ausência.

Essa política será consumida pelo contrato de reservas. Ela não decide conflitos: sobreposição continuará impedida pela constraint de exclusão definida no ADR-005.

## Segurança

- `equipment.read` para consulta e `equipment.manage` para mutações;
- autorização papel × laboratório no servidor;
- todas as consultas filtram `laboratory_id` e usam parâmetros PostgreSQL;
- referências de catálogo são validadas no laboratório e no tipo esperado;
- respostas não incluem linhas brutas do catálogo;
- erros públicos não incluem SQL, parâmetros, stack trace ou detalhes internos.

## Critérios de aceite

- [x] Contrato compartilhado congelado e testado.
- [x] Migração com integridade laboratório × referências.
- [x] API nas quatro camadas SOLID, autenticada e auditada.
- [x] Página PT-BR responsiva com estado vazio e cadastro real.
- [x] JWT mantido apenas em cookie `HttpOnly` na camada web.
- [x] Nenhum equipamento de demonstração criado.
- [x] Typecheck, lint, testes e build verdes.
- [x] Fluxo real validado no Docker local.
