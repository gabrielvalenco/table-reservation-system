# ADR 001 — Stack do projeto

- **Status:** aceita
- **Data:** 2026-10-20

## Contexto

Este projeto reescreve o [Sistema-de-Reservas](https://github.com/BrenoMF04/Sistema-de-Reservas) (PHP + MySQL + JS puro). Os problemas do original não vinham da linguagem. Vinham da modelagem e da regra de negócio:

- A checagem de conflito é *check-then-act* (SELECT seguido de INSERT), então duas requisições simultâneas reservam a mesma mesa.
- A reserva não tem duração. Mesa 3 às 19:00 e às 19:15 não conflitam.
- A edição usa outra regra de conflito que a criação.
- Front e back validam coisas diferentes.

Por isso a stack precisa, antes de tudo, garantir a integridade da agenda **no banco**. Também deve facilitar o compartilhamento de regras entre front e back.

## Decisão

| Camada | Escolha |
|---|---|
| Banco | PostgreSQL |
| Backend | Node.js LTS + TypeScript + Fastify |
| Acesso a dados | SQL puro com `pg` (sem ORM) |
| Migrations | Arquivos `.sql` numerados, aplicados por script próprio |
| Validação | Zod, com schemas compartilhados entre front e back |
| Frontend | React + Vite + TypeScript |
| Estado do servidor (front) | TanStack Query |
| Formulários | React Hook Form + Zod |
| Rotas (front) | React Router |
| Estilo | CSS Modules |
| Testes | Vitest contra um Postgres real (Docker) |
| Ambiente local | Docker Compose |
| Organização | Monorepo com npm workspaces |

```
apps/api         → Fastify + pg + migrations
apps/web         → React + Vite
packages/shared  → schemas Zod e tipos compartilhados
```

## Justificativas

**PostgreSQL.** Uma exclusion constraint (`EXCLUDE USING gist` sobre `tstzrange`) faz o banco recusar duas reservas sobrepostas na mesma mesa. Isso elimina a condição de corrida e o problema da duração no nível mais baixo possível, sem depender de lock correto em cada caminho de escrita da aplicação.

**TypeScript nos dois lados.** O time é de duas pessoas, então uma linguagem só tem valor real. Os tipos pegam erros como trocar `mesa_numero` por `mesa_id` na compilação.

**Fastify.** É fino e explícito. Traz logs estruturados (pino), validação e hooks sem impor arquitetura.

**Sem ORM.** O núcleo do domínio é SQL: intervalos, constraint e consulta de disponibilidade. Os ORMs populares não expressam bem `EXCLUDE` e `tstzrange`, e acabaríamos escrevendo SQL na mão de qualquer forma.

**Zod compartilhado.** A regra de entrada (campos, limites, formatos) fica escrita uma vez só em `packages/shared` e vale na API e no formulário.

**React + Vite.** Tem o maior ecossistema para formulários, tabelas e seleção de data. O Vite é apenas bundler e dev server.

**Testes com Postgres real.** A regra crítica vive no banco, e mockar o banco testaria o mock.

## Alternativas descartadas

- **Manter PHP.** Funcionaria, mas seriam duas linguagens para dois devs e um ferramental de tipos e testes mais fraco.
- **MySQL.** Não tem exclusion constraint. Impedir sobreposição exigiria `SELECT ... FOR UPDATE` correto em todo caminho de escrita.
- **Next.js.** Tem backend próprio, o que duplicaria o papel do Fastify ou espalharia a regra de negócio entre componentes e handlers.
- **Laravel / NestJS.** São frameworks pesados demais para um domínio pequeno com uma regra difícil.
- **Prisma / TypeORM.** Não modelam bem `EXCLUDE` e ranges.
- **Turborepo / Nx.** São três pacotes, e npm workspaces resolve.
- **Tailwind.** Pode ser reavaliado. CSS Modules basta no tamanho atual.

## Consequências

- O mapeamento entre linhas do banco e objetos é manual. Para poucas tabelas isso é aceitável. Se o schema crescer muito, reavaliamos um query builder (ex.: Kysely).
- Postgres vira requisito também nos testes. SQLite não serve.
- React traz build e dependências para manter atualizadas.
