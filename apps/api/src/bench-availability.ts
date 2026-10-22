// Mede a consulta de disponibilidade com 50 mesas e um mês de reservas (requisito: p95 < 300 ms).
// Usa um banco próprio (reservas_bench), recriado a cada execução; nunca mexe no banco de desenvolvimento.
import pg from "pg";
import { z } from "zod";
import { buildApp } from "./app.js";
import { migrate } from "./migrate.js";

const { DATABASE_URL } = z.object({ DATABASE_URL: z.url() }).parse(process.env);
const BENCH_DB = "reservas_bench";
const TABLES = 50;
const REQUESTS = 300;

const adminUrl = new URL(DATABASE_URL);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${BENCH_DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${BENCH_DB}`);
await admin.end();

const benchUrl = new URL(DATABASE_URL);
benchUrl.pathname = `/${BENCH_DB}`;
const pool = new pg.Pool({ connectionString: benchUrl.toString() });
await migrate(pool);

await pool.query("INSERT INTO tables (number, capacity) SELECT n, 2 + (n % 4) * 2 FROM generate_series(1, $1) AS n", [TABLES]);

// Ocupa ~70% dos horários de jantar dos próximos 30 dias em cada mesa: um cenário bem cheio.
const { rowCount } = await pool.query(
  `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email)
   SELECT t.id, s.start, s.start + interval '2 hours', 2, 'Bench', 'bench-' || t.id || '-' || d, 'b' || t.id || '-' || d || '@bench.local'
   FROM tables t
   CROSS JOIN generate_series(0, 29) AS d
   CROSS JOIN LATERAL (SELECT (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + make_interval(days => d) + interval '19 hours') AT TIME ZONE 'America/Sao_Paulo' AS start) s
   WHERE (t.id + d) % 10 < 7`,
);

const app = buildApp(pool);
const durations: number[] = [];
const today = new Date();
for (let index = 0; index < REQUESTS; index++) {
  const day = new Date(today.getTime() + (1 + (index % 28)) * 86_400_000).toISOString().slice(0, 10);
  const started = performance.now();
  const response = await app.inject({ method: "GET", url: `/api/availability?date=${day}&partySize=${2 + (index % 6)}` });
  durations.push(performance.now() - started);
  if (response.statusCode !== 200) throw new Error(`HTTP ${response.statusCode}`);
}

durations.sort((a, b) => a - b);
const percentile = (p: number) => durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))]!;
console.log(`${TABLES} mesas, ${rowCount} reservas, ${REQUESTS} consultas (sequenciais, sem rede):`);
console.log(`  p50 ${percentile(50).toFixed(1)} ms · p95 ${percentile(95).toFixed(1)} ms · p99 ${percentile(99).toFixed(1)} ms · máx ${durations.at(-1)!.toFixed(1)} ms`);
const ok = percentile(95) < 300;
console.log(ok ? "OK: p95 abaixo de 300 ms." : "FALHA: p95 acima de 300 ms.");

await app.close();
await pool.end();
process.exit(ok ? 0 : 1);
