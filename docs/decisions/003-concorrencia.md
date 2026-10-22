# ADR 003 — Concorrência nas reservas

**Status:** aceita · 2026-10-22

## Problema

Dois pedidos simultâneos não podem ocupar a mesma mesa no mesmo horário, nem o mesmo contato pode ter duas reservas ativas no mesmo turno. Ao adicionar os índices únicos do contato (e-mail e telefone) ao `EXCLUDE` da mesa, os testes de concorrência começaram a falhar de forma intermitente: o Postgres desfazia um dos pedidos com `40P01` (deadlock) e a API respondia 500.

## Decisão

1. **O banco continua sendo quem garante as regras**: `EXCLUDE USING gist` para a mesa e dois índices únicos parciais para o contato. O código nunca confia só no SELECT.
2. **Cada INSERT roda numa transação que antes pega um lock consultivo do dia** (`pg_advisory_xact_lock`). Os pedidos do mesmo dia entram em fila. Para o volume de um restaurante o custo é desprezível, e o deadlock deixa de acontecer.
3. **Se ainda assim vier `40P01`, o INSERT é repetido** (até 6 vezes, com espera aleatória curta). Na nova tentativa o conflito já está visível e vira `23P01` (mesa ocupada, tenta a próxima mesa) ou `23505` (contato repetido, responde 409).

Os erros de restrição viram respostas de negócio (`409 no_table_available`, `409 already_reserved`). Qualquer outro erro continua sendo 500.

## Alternativas descartadas

- **Só o retry, sem o lock:** passou de 4 falhas em 6 execuções para 1 em 8, mas deixou lentidão (cada deadlock leva 1s para ser detectado) e um teste estourando o tempo. Não é determinístico.
- **`SERIALIZABLE`:** exigiria retry em todos os caminhos de escrita e esconde a regra de negócio na configuração da transação.
- **Um lock global:** serializa dias que nunca conflitam. O lock por dia é suficiente.

## Custo

- Pedidos do mesmo dia são processados um de cada vez. Se o volume crescer muito, reavaliar (por exemplo, lock por mesa).
- A tabela `reservations` tem 3 índices de unicidade ou exclusão. Ao mexer neles, rode os testes de concorrência várias vezes seguidas: a falha era intermitente.
