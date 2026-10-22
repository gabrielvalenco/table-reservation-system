# table-reservation-system

Sistema de reserva de mesas para restaurante.

> 🚧 Em construção. Veja os [requisitos](docs/requisitos.md) e o [roadmap](docs/roadmap.md).

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
apps/api   API (Fastify)
apps/web   Frontend (React)
docs/      Requisitos e decisões
```

## Rodando local

Requer Node 22+ e Docker.

```sh
cp .env.example .env
npm install
npm run db:up
npm run db:seed       # 11 mesas de desenvolvimento
npm run dev:api   # http://localhost:3000/api/health
npm run dev:web   # http://localhost:5173
```

Demonstração de concorrência (com a API no ar): `npm run demo:concurrency` dispara 20 pedidos simultâneos para a única mesa de 8 lugares e confirma que só 1 reserva é criada.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Licença

[Apache 2.0](LICENSE)
