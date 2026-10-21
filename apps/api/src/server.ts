import pg from "pg";
import { z } from "zod";
import { buildApp } from "./app.js";

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
  })
  .parse(process.env);

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

await buildApp(pool, { logger: true }).listen({ port: env.PORT, host: "0.0.0.0" });
