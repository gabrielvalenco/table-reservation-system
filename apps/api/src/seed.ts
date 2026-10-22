import pg from "pg";
import { z } from "zod";
import { migrate } from "./migrate.js";
import { hashPassword } from "./security.js";

const { DATABASE_URL, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD } = z
  .object({ DATABASE_URL: z.url(), SEED_STAFF_EMAIL: z.email().optional(), SEED_STAFF_PASSWORD: z.string().min(10).optional() })
  .parse(process.env);

// Salão de desenvolvimento: 11 mesas, com uma única de 8 lugares (útil para demonstrar concorrência).
const layout = [
  ...[1, 2, 3, 4].map((number) => ({ number, capacity: 2 })),
  ...[5, 6, 7, 8].map((number) => ({ number, capacity: 4 })),
  ...[9, 10].map((number) => ({ number, capacity: 6 })),
  { number: 11, capacity: 8 },
];

const pool = new pg.Pool({ connectionString: DATABASE_URL });
await migrate(pool);

const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM tables");
if (Number(rows[0]!.count) > 0) {
  console.log(`O banco já tem ${rows[0]!.count} mesas; nada a fazer.`);
} else {
  await pool.query("INSERT INTO tables (number, capacity) SELECT * FROM unnest($1::int[], $2::int[])", [
    layout.map((table) => table.number),
    layout.map((table) => table.capacity),
  ]);
  console.log(`Criadas ${layout.length} mesas.`);
}

if (SEED_STAFF_EMAIL && SEED_STAFF_PASSWORD) {
  await pool.query(
    `INSERT INTO staff_users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO NOTHING`,
    [SEED_STAFF_EMAIL, "Equipe (desenvolvimento)", await hashPassword(SEED_STAFF_PASSWORD)],
  );
  console.log(`Usuário da equipe de desenvolvimento: ${SEED_STAFF_EMAIL}`);
}

await pool.end();
