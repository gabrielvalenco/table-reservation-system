# Roadmap

Proposta para discutir. Nada aqui altera os [requisitos da v1](requisitos.md) até ser aceito.

## Onde estamos

- Banco recusa reservas sobrepostas (`EXCLUDE USING gist`), com testes de concorrência no banco e na API.
- `POST /api/reservations` (atribui a menor mesa livre) e `GET /api/availability`.
- Tela do cliente: data, pessoas, horários livres e formulário. Sem e-mail e sem como cancelar.
- Não existe nada para a equipe: sem login, agenda ou gestão de mesas.

## Objetivo

Um restaurante real recebendo reservas em produção, com um diferencial claro sobre o projeto original: **o sistema nunca reserva duas vezes a mesma mesa, e a equipe enxerga e opera o salão com facilidade.**

## Fase 1 — Prova e base (pequena)

- [x] Testes de concorrência (banco e API).
- [ ] `npm run db:seed` e `npm run demo:concurrency`: demonstração executável de N pedidos simultâneos resultando em 1 reserva.
- [ ] README com a comparação com o projeto original.
- [ ] Decidir se a tabela `restaurants` entra já no schema (ver Fase 4).

## Fase 2 — Área da equipe (maior salto de produto)

Backend e frontend podem andar em paralelo se o contrato dos endpoints for combinado antes.

- Login (e-mail e senha com argon2id, cookie `HttpOnly`/`Secure`/`SameSite`).
- Agenda do dia em **linha do tempo**: uma linha por mesa, blocos de 2h, visível de relance.
- Trocar a mesa de uma reserva, cancelar, marcar `concluída` e `não compareceu`.
- CRUD de mesas (ativar e desativar sem apagar).
- Painel simples: ocupação por turno e taxa de não comparecimento.

## Fase 3 — Ciclo completo do cliente

- Link secreto por e-mail para cancelar (token de 128 bits ou mais, só o hash no banco).
- E-mail de confirmação (falha no envio não desfaz a reserva) e arquivo `.ics` para o calendário.
- Quando um horário estiver cheio, sugerir os mais próximos.

## Fase 4 — Rede de unidades (v2)

Hoje é **fora da v1**. Várias unidades, cada uma com mesas, turnos e dias de folga próprios. Mexe no schema inteiro, então decidir cedo é mais barato: uma tabela `restaurants` e `restaurant_id` em `tables` desde a próxima migration custa pouco agora e muito depois.

## Produção (em paralelo às fases)

Os itens de "Pronto para produção" dos requisitos: HTTPS, backup com restore testado, monitor com alerta, SPF/DKIM, aviso de privacidade, rate limit e deploy documentado.

## Decisões em aberto

1. Entra `restaurants` no schema agora?
2. Regras reais do restaurante (duração, turnos, cancelamento). Hoje estão fixas em `apps/api/src/reservations/rules.ts` e duplicadas em `apps/web/src/App.tsx` (dias de folga). Mover para `packages/shared` ou para uma tabela de configuração.
3. Provedor de e-mail e domínio.
4. O que fazer com grupo maior que a maior mesa.
