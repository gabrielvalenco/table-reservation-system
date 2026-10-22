# Roadmap

Proposta para discutir. Nada aqui altera os [requisitos da v1](requisitos.md) até ser aceito.

## Onde estamos

- Banco recusa reservas sobrepostas (`EXCLUDE USING gist`) e contato repetido no turno, com testes de concorrência no banco e na API ([ADR 003](decisions/003-concorrencia.md)).
- Cliente: ver horários, reservar, e-mail de confirmação com `.ics`, link secreto para ver e cancelar (até 2h antes), aviso de privacidade.
- Equipe: login, agenda em linha do tempo, busca e filtros, criar e editar reservas (trocar mesa), cancelar, concluída e não compareceu, CRUD de mesas, painel.
- Rate limit, logs sem dado pessoal, anonimização após 180 dias, backup e restauração testados, imagens de produção (Docker + Caddy) testadas localmente.
- Falta tudo o que depende de fora do código: VPS, domínio, provedor de e-mail, monitor, e as decisões do restaurante. Veja [operação](operacao.md).

## Objetivo

Um restaurante real recebendo reservas em produção, com um diferencial claro sobre o projeto original: **o sistema nunca reserva duas vezes a mesma mesa, e a equipe enxerga e opera o salão com facilidade.**

## Fases 1 a 3 — feitas

- [x] Testes de concorrência, `db:seed`, `demo:concurrency`, README.
- [x] Área da equipe: login, agenda em linha do tempo, edição e troca de mesa, mesas, painel.
- [x] Ciclo do cliente: link secreto, cancelamento, e-mail de confirmação, `.ics`.
- [ ] Sugerir horários próximos quando o horário pedido está cheio.
- [ ] Lembrete por e-mail antes da reserva; cliente alterar (não só cancelar) pelo link.
- [ ] Turnos, dias de folga e datas bloqueadas editáveis na interface (hoje fixos em `rules.ts`).
- [ ] Gestão de usuários da equipe pela interface e histórico de alterações.

## Fase 4 — Rede de unidades (v2)

Hoje é **fora da v1**. Várias unidades, cada uma com mesas, turnos e dias de folga próprios. Mexe no schema inteiro, então decidir cedo é mais barato: uma tabela `restaurants` e `restaurant_id` em `tables` desde a próxima migration custa pouco agora e muito depois.

## Produção

Feito e testado localmente: imagens, HTTPS com Caddy, cabeçalhos de segurança, rate limit, logs, backup e restauração. Falta na VPS real: subir, restaurar um backup lá, monitor com alerta, SPF/DKIM e o aviso de privacidade final. Detalhes em [operacao.md](operacao.md).

## Decisões em aberto

1. Entra `restaurants` no schema agora? (rede de unidades, Fase 4)
2. Regras reais do restaurante (duração, turnos, cancelamento). Hoje estão em `apps/api/src/reservations/rules.ts`; o front já lê tudo de `GET /api/config`. O próximo passo é guardá-las no banco, editáveis pela equipe.
3. Provedor de e-mail e domínio.
