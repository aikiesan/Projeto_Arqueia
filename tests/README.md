# tests/

Testes end-to-end e de integração que cruzam apps (Playwright). Testes unitários de domínio e de casos de uso ficam junto de cada módulo em `apps/api`.

Fluxos críticos a cobrir (ver `AGENTS.md` §5):
- Login e autorização papel×laboratório (acesso negado no servidor).
- QR → ficha do item → retirada (saldo derivado do ledger).
- Reserva com conflito (constraint de exclusão barra sobreposição).
- Retirada de reagente controlado (falha sem cadeia de custódia).
- Portal multiusuário (token não previsível, acompanhamento sem conta).
