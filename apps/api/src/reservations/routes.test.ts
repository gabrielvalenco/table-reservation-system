import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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

const valid = {
  name: "Ana Souza",
  partySize: 3,
  startsAt: "2026-11-10T19:00:00-03:00",
};

// Cada pedido usa um contato novo, para os testes não esbarrarem na regra de 1 reserva por contato e turno.
let contact = 0;

function post(body: object) {
  contact += 1;
  const unique = { email: `cliente${contact}@example.com`, phone: `(11) 9${String(contact).padStart(4, "0")}-0000` };
  return app.inject({ method: "POST", url: "/api/reservations", payload: { ...unique, ...body } });
}

async function tableOf(id: string) {
  const { rows } = await pool.query<{ number: number }>(
    "SELECT t.number FROM reservations r JOIN tables t ON t.id = r.table_id WHERE r.id = $1",
    [id],
  );
  return rows[0]!.number;
}

describe("POST /api/reservations", () => {
  it("cria a reserva com 2h de duração", async () => {
    const response = await post(valid);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      partySize: 3,
      status: "confirmed",
      startsAt: "2026-11-10T22:00:00.000Z",
      endsAt: "2026-11-11T00:00:00.000Z",
    });
  });

  it("atribui a menor mesa que comporta o grupo", async () => {
    const first = await post(valid);
    const second = await post(valid);

    expect(await tableOf(first.json().id)).toBe(2);
    expect(await tableOf(second.json().id)).toBe(3);
  });

  it("responde 409 quando não há mesa livre que comporte o grupo", async () => {
    await post(valid);
    await post(valid);

    expect((await post(valid)).json()).toEqual({ error: "no_table_available" });
    expect((await post({ ...valid, partySize: 7 })).statusCode).toBe(409);
  });

  it("ignora mesas desativadas", async () => {
    await pool.query("UPDATE tables SET active = false WHERE number = 2");

    const response = await post(valid);

    expect(await tableOf(response.json().id)).toBe(3);
  });

  it("libera a mesa fora do horário da reserva", async () => {
    await post(valid);

    const response = await post({ ...valid, startsAt: "2026-11-10T21:00:00-03:00" });

    expect(await tableOf(response.json().id)).toBe(2);
  });

  it("com pedidos simultâneos, distribui entre as mesas livres e recusa o excedente", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => post({ ...valid, partySize: 2 })),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 201, 201, 409, 409]);
  });

  it("responde 400 com regra de horário violada", async () => {
    const response = await post({ ...valid, startsAt: "2026-11-10T16:00:00-03:00" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "closed" });
  });

  it.each([
    { name: "" },
    { email: "nao-e-email" },
    { phone: "123" },
    { partySize: 0 },
    { startsAt: "2026-11-10 19:00" },
  ])("responde 400 com entrada inválida: %o", async (override) => {
    const response = await post({ ...valid, ...override });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_body");
  });
});
