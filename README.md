# table-reservation-system

Sistema de reserva de mesas para restaurante.

> 🚧 Em construção. Veja os [requisitos](docs/requisitos.md), o [roadmap](docs/roadmap.md) e o guia de [operação](docs/operacao.md).

## Como funciona

- **Cliente:** escolhe data, horário e nº de pessoas. O sistema atribui a menor mesa livre que comporte o grupo e envia por e-mail a confirmação, um arquivo de calendário (`.ics`) e um **link secreto** para ver e cancelar a reserva (até 2h antes). Não precisa criar conta.
- **Equipe:** entra com e-mail e senha. Vê a **agenda do dia em linha do tempo** (uma linha por mesa), busca e filtra reservas, cria e edita (inclusive trocando a mesa), cancela, marca concluída ou não compareceu, gerencia as mesas e acompanha um painel com ocupação por turno e taxa de não comparecimento.
- **Sem reserva duplicada:** o banco impede duas reservas sobrepostas na mesma mesa (`EXCLUDE` + `tstzrange`), mesmo com pedidos simultâneos. Cada contato (e-mail ou telefone) tem no máximo 1 reserva ativa por turno, também garantido pelo banco.
- **LGPD:** só nome, telefone e e-mail; aviso de privacidade em `/privacidade`; dados anonimizados após 180 dias.

### Por que não é só mais um sistema de reservas

O [projeto que inspirou este](https://github.com/BrenoMF04/Sistema-de-Reservas) deixava duas pessoas reservarem a mesma mesa (SELECT e depois INSERT, sem proteção). Aqui a regra vive no banco, e há testes que provam isso: [schema.test.ts](apps/api/src/schema.test.ts) (10 inserts simultâneos, 1 vence), [customer.test.ts](apps/api/src/reservations/customer.test.ts) (5 pedidos simultâneos do mesmo contato, 1 vence) e a demonstração `npm run demo:concurrency`.

## Stack

| | |
|---|---|
| Backend | Node.js + TypeScript + Fastify |
| Banco | PostgreSQL (SQL puro, sem ORM) |
| Frontend | React + Vite + TanStack Query + shadcn/ui (Tailwind) |
| Validação | Zod, compartilhado entre front e back (`packages/shared`) |
| Testes | Vitest + Postgres real |
| Infra | Docker Compose, Caddy (HTTPS) |

Por quê: [ADR 001](docs/decisions/001-stack.md). Hospedagem: [ADR 002](docs/decisions/002-hospedagem.md). Concorrência: [ADR 003](docs/decisions/003-concorrencia.md).

## Estrutura

```
apps/api         API (Fastify)
apps/web         Frontend (React): cliente em /, equipe em /equipe
packages/shared  Schemas Zod e tipos usados pelos dois
scripts/         Backup e restauração do banco
docs/            Requisitos, roadmap, operação e decisões
```

## Rodando local

Requer Node 22+ e Docker.

```sh
cp .env.example .env
npm install
npm run db:up         # Postgres e Mailpit (e-mails em http://localhost:8025)
npm run db:seed       # 11 mesas e o usuário da equipe de desenvolvimento
npm run dev:api       # http://localhost:3000/api/health
npm run dev:web       # http://localhost:5173
```

O usuário da equipe de desenvolvimento vem de `SEED_STAFF_EMAIL` e `SEED_STAFF_PASSWORD` no `.env`. Entre em `/equipe`. Em produção, crie usuários com `npm run staff:create -- email "Nome" senha` (veja [operação](docs/operacao.md)).

Outros comandos:

| | |
|---|---|
| `npm run demo:concurrency` | 10 pedidos simultâneos para a única mesa de 8 lugares: só 1 reserva é criada (API no ar; 10 é o limite do rate limit) |
| `npm run bench:availability` | mede a disponibilidade com 50 mesas e 1 mês de reservas (meta: p95 < 300 ms) |
| `npm run lint` · `typecheck` · `test` · `build` | os checks que o CI roda |

## Produção

`docker-compose.prod.yml` sobe o banco, a API e o Caddy com HTTPS. Deploy, rollback, backup, restauração e monitoramento estão em [docs/operacao.md](docs/operacao.md), que também diz o que já foi testado e o que só dá para conferir na VPS real.

## Licença

[Apache 2.0](LICENSE)
