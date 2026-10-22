import pg from "pg";
import { z } from "zod";
import { migrate } from "./migrate.js";

const { DATABASE_URL } = z.object({ DATABASE_URL: z.url() }).parse(process.env);

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

await pool.end();
