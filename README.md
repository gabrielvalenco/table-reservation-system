# table-reservation-system

Sistema de reserva de mesas para restaurante.

> 🚧 Em construção. Ainda não há código: veja os [requisitos](docs/requisitos.md).

## Como funciona

- **Cliente:** escolhe data, horário e nº de pessoas. O sistema atribui a mesa e envia um link por e-mail para cancelar ou alterar a reserva. Não precisa criar conta.
- **Equipe:** faz login e gerencia a agenda, as mesas e os horários de funcionamento.
- **Sem reserva duplicada:** o banco impede duas reservas sobrepostas na mesma mesa.

## Stack

| | |
|---|---|
| Backend | Node.js + TypeScript + Fastify |
| Banco | PostgreSQL (SQL puro, sem ORM) |
| Frontend | React + Vite |
| Validação | Zod, compartilhado entre front e back |
| Testes | Vitest + Postgres real |
| Infra | Docker Compose |

Por quê: [ADR 001](docs/decisions/001-stack.md). Hospedagem: [ADR 002](docs/decisions/002-hospedagem.md).

## Estrutura

```
apps/api         API (Fastify)
apps/web         Frontend (React)
packages/shared  Schemas e tipos compartilhados
docs/            Requisitos e decisões
```

## Licença

[Apache 2.0](LICENSE)
