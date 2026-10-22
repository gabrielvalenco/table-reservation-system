import pg from "pg";
import { afterAll, beforeEach, expect, it } from "vitest";
import { testDatabaseUrl } from "../test/database.js";

const pool = new pg.Pool({ connectionString: testDatabaseUrl });

afterAll(() => pool.end());
beforeEach(() => pool.query("TRUNCATE reservations, tables RESTART IDENTITY"));

const at = (time: string) => `2026-11-10T${time}:00-03:00`;

async function createTable(number: number) {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO tables (number, capacity) VALUES ($1, 4) RETURNING id",
    [number],
  );
  return rows[0]!.id;
}

// Cada reserva ganha um contato próprio: o mesmo contato só pode ter 1 reserva ativa por turno.
let contact = 0;

function reserve(tableId: number, start: string, end: string, status = "confirmed") {
  contact += 1;
  return pool.query(
    `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email, status)
     VALUES ($1, $2, $3, 2, 'Ana', $5, $6, $4)`,
    [tableId, at(start), at(end), status, `1199${String(contact).padStart(7, "0")}`, `ana${contact}@example.com`],
  );
}

it("rejeita reserva sobreposta na mesma mesa", async () => {
  const table = await createTable(1);
  await reserve(table, "19:00", "21:00");

  await expect(reserve(table, "20:00", "22:00")).rejects.toMatchObject({ code: "23P01" });
});

it("aceita reservas encostadas na mesma mesa", async () => {
  const table = await createTable(1);
  await reserve(table, "19:00", "21:00");

  await expect(reserve(table, "21:00", "23:00")).resolves.toBeDefined();
});

it("aceita o mesmo horário em mesas diferentes", async () => {
  await reserve(await createTable(1), "19:00", "21:00");

  await expect(reserve(await createTable(2), "19:00", "21:00")).resolves.toBeDefined();
});

it("reserva cancelada libera o horário", async () => {
  const table = await createTable(1);
  await reserve(table, "19:00", "21:00", "cancelled");

  await expect(reserve(table, "19:00", "21:00")).resolves.toBeDefined();
});

it("rejeita fim antes do início", async () => {
  await expect(reserve(await createTable(1), "21:00", "19:00")).rejects.toMatchObject({ code: "23514" });
});

it("de 10 reservas simultâneas para a mesma mesa e horário, só 1 é criada", async () => {
  const table = await createTable(1);

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => reserve(table, "19:00", "21:00")),
  );

  const rejected = results.filter((result) => result.status === "rejected");
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(rejected.map((result) => result.reason.code)).toEqual(Array(9).fill("23P01"));
});
