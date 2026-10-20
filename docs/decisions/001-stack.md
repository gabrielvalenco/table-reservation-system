# ADR 001 — Stack

**Status:** aceita · 2026-10-20

## Problema

O [projeto original](https://github.com/BrenoMF04/Sistema-de-Reservas) deixa duas pessoas reservarem a mesma mesa: ele faz SELECT e depois INSERT, sem lock. Além disso, a reserva não tem duração e front e back validam coisas diferentes. A linguagem não era o problema. A regra de negócio, sim.

## Decisão

| | Escolha | Por quê |
|---|---|---|
| Banco | PostgreSQL | `EXCLUDE USING gist` + `tstzrange`: o banco recusa reserva sobreposta. Sem corrida. |
| Backend | Node + TypeScript + Fastify | Uma linguagem para dois devs. Fastify é fino e já traz log estruturado. |
| Dados | SQL puro (`pg`) | O núcleo é SQL. ORM esconderia justamente o que importa. |
| Migrations | `.sql` numerados | Legível e versionado. Sem ferramenta extra. |
| Validação | Zod em `packages/shared` | A regra é escrita uma vez e vale no front e no back. |
| Frontend | React + Vite + TanStack Query | Ecossistema para formulário, tabela e cache de dados do servidor. |
| Testes | Vitest + Postgres real | A regra vive no banco. Mock testaria o mock. |
| Infra | Docker Compose, monorepo npm workspaces | Um comando sobe tudo. |

## Descartado

- **PHP:** funcionaria, mas seriam duas linguagens e tipos/testes mais fracos.
- **MySQL:** não tem exclusion constraint, o que obriga a `FOR UPDATE` em todo caminho de escrita.
- **Next.js:** seria um segundo backend competindo com o Fastify.
- **Prisma/TypeORM:** não modelam `EXCLUDE` nem ranges.
- **Nest, Laravel, Turborepo:** grandes demais para o problema.

## Custo

- O mapeamento entre linhas e objetos é manual. Se o schema crescer muito, reavaliamos o Kysely.
- Postgres é obrigatório até nos testes.
