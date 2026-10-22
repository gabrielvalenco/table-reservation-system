import pg from "pg";
import { z } from "zod";
import { migrate } from "./migrate.js";
import { hashPassword } from "./security.js";

// Uso: npm run staff:create -- <email> <nome> <senha>
const { DATABASE_URL } = z.object({ DATABASE_URL: z.url() }).parse(process.env);
const [email, name, password] = z.tuple([z.email(), z.string().min(1), z.string().min(10)]).parse(process.argv.slice(2));

const pool = new pg.Pool({ connectionString: DATABASE_URL });
await migrate(pool);
await pool.query(
  `INSERT INTO staff_users (email, name, password_hash) VALUES ($1, $2, $3)
   ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, active = true`,
  [email, name, await hashPassword(password)],
);
console.log(`Usuário da equipe pronto: ${email}`);
await pool.end();
