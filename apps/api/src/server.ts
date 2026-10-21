import pg from "pg";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const app = buildApp({ pool, logger: true });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await app.close();
    await pool.end();
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
