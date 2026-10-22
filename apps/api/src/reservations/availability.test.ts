import pg from "pg";
import { afterAll, beforeEach, expect, it } from "vitest";
import { testDatabaseUrl } from "../../test/database.js";
import { buildApp } from "../app.js";

const pool = new pg.Pool({ connectionString: testDatabaseUrl });
const app = buildApp(pool, { now: () => new Date("2026-11-08T12:00:00-03:00") });

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE reservations, tables RESTART IDENTITY");
  await pool.query("INSERT INTO tables (number, capacity) VALUES (1, 2), (2, 4), (3, 6)");
});

const tuesday = (time: string) => new Date(`2026-11-10T${time}:00-03:00`).toISOString();

async function slots(query: string, server = app) {
  const response = await server.inject(`/api/availability?${query}`);
  expect(response.statusCode).toBe(200);
  return response.json().slots;
}

it("lista todos os horários do dia quando não há reservas", async () => {
  expect(await slots("date=2026-11-10&partySize=2")).toEqual(
    ["11:30", "12:00", "12:30", "13:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map(tuesday),
  );
});

it("tira os horários em que a única mesa que comporta o grupo está ocupada", async () => {
  await pool.query(
    `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email)
     VALUES (3, $1, $2, 5, 'Ana', '11999999999', 'ana@example.com')`,
    [tuesday("19:00"), tuesday("21:00")],
  );

  expect(await slots("date=2026-11-10&partySize=5")).toEqual(
    ["11:30", "12:00", "12:30", "13:00", "21:00"].map(tuesday),
  );
});

it("mantém o horário se outra mesa comporta o grupo", async () => {
  await pool.query(
    `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email)
     VALUES (2, $1, $2, 3, 'Ana', '11999999999', 'ana@example.com')`,
    [tuesday("19:00"), tuesday("21:00")],
  );

  expect(await slots("date=2026-11-10&partySize=3")).toContain(tuesday("19:00"));
});

it("retorna vazio para grupo maior que a maior mesa", async () => {
  expect(await slots("date=2026-11-10&partySize=7")).toEqual([]);
});

it("retorna vazio em dia fechado", async () => {
  expect(await slots("date=2026-11-09&partySize=2")).toEqual([]);
});

it("respeita a antecedência mínima no próprio dia", async () => {
  const lateAfternoon = buildApp(pool, { now: () => new Date("2026-11-10T18:30:00-03:00") });

  expect(await slots("date=2026-11-10&partySize=2", lateAfternoon)).toEqual(
    ["19:30", "20:00", "20:30", "21:00"].map(tuesday),
  );
  await lateAfternoon.close();
});

it.each(["date=10/11/2026&partySize=2", "date=2026-11-10", "date=2026-11-10&partySize=0"])(
  "responde 400 com query inválida: %s",
  async (query) => {
    const response = await app.inject(`/api/availability?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_query");
  },
);
