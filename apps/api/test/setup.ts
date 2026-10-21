import pg from "pg";
import { migrate } from "../src/migrate.js";
import { testDatabaseUrl } from "./database.js";

export default async function setup() {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await migrate(pool);
  await pool.end();
}
