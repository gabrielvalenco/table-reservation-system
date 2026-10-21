import { readdir, readFile } from "node:fs/promises";
import type pg from "pg";

const dir = new URL("../migrations/", import.meta.url);

export async function migrate(pool: pg.Pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const pending = (await readdir(dir)).filter((file) => file.endsWith(".sql") && !applied.has(file)).sort();

  for (const file of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(new URL(file, dir), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
