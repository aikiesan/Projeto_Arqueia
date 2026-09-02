# ADR 009: Identidade local pseudonimizada para o MVP interno do CP2B

- **Status:** Aceito
- **Data:** 01/09/2026
- **Decisores:** Coordenação do CP2B e arquitetura do Arqueia
- **Substitui parcialmente:** ADR-008, apenas quanto à obrigatoriedade de OIDC no MVP

## Contexto

O primeiro ambiente do Arqueia será interno, hospedado em VM institucional da Unicamp e restrito a pessoas previamente aprovadas pela Coordenação do CP2B. Usuários comuns consultarão informações autorizadas do laboratório e solicitarão reservas de equipamentos. O MVP não necessita de nome, e-mail, matrícula, telefone ou identificador institucional dentro da aplicação.

## Decisão

1. A conta local usa um `loginCode` opaco e único, senha armazenada somente como hash Argon2id, categoria acadêmica, laboratório e status.
2. A categoria acadêmica (`IC`, `MESTRADO`, `DOUTORADO`, `POS_DOUTORADO`, `PESQUISADOR`) é metadado e nunca concede permissão administrativa.
3. A Coordenação recebe o papel laboratorial `GESTOR_ACESSO_CP2B`; não recebe `ADMIN` global.
4. O papel `USUARIO` pode consultar laboratório/equipamentos/agenda, solicitar reserva e cancelar somente a própria reserva.
5. Reservas alheias aparecem como ocupadas, sem código, finalidade, projeto ou notas.
6. OIDC permanece fora do gate do MVP. Poderá ser reavaliado se a Unicamp disponibilizar um provedor e exigir integração futura.
7. MFA não é exigido do usuário comum. Contas administrativas permanecem sujeitas a reautenticação para alterações sensíveis.
8. A Coordenação mantém, fora do Arqueia e sob controle institucional, o vínculo entre código e pessoa para concessão, suporte e revogação.
9. Contas autorizadas nascem ativas, com papel `USUARIO` e troca obrigatória da senha temporária. O gestor não pode elevar usuários a papéis técnicos ou administrativos.
10. IP e user-agent não são persistidos pelo banco da aplicação. O tratamento transitório no rate limit e os logs do proxy/servidor pertencem ao controle operacional institucional.

## Fluxo

```text
Coordenação aprova pessoa fora do sistema
        ↓
Gestor de acesso cria conta no laboratório
        ↓
Arqueia gera código único e recebe senha temporária
        ↓
Usuário troca a senha no primeiro acesso
        ↓
Agenda expõe detalhes próprios e apenas ocupação de terceiros
```

## Consequências e trade-offs

- O banco e as respostas públicas deixam de conter nome/e-mail do usuário.
- O código continua sendo dado pseudonimizado porque existe vínculo institucional externo.
- Recuperação de senha é administrativa, já que não há e-mail no sistema.
- O menor privilégio reduz impacto de comprometimento, mas exige um papel específico para a Coordenação.
- OIDC poderá reduzir a administração manual no futuro, porém não bloqueia o MVP.

## Pontos a revisitar

- Integração institucional de identidade se o número de usuários crescer.
- MFA para gestores de acesso.
- Expiração automática de vínculos acadêmicos.
- Política definitiva de retenção de sessões e dos logs de proxy/servidor mantidos pela infraestrutura.
