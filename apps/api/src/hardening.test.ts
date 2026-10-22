import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import Fastify from "fastify";
import { testDatabaseUrl } from "../test/database.js";
import { NOW, STAFF, createStaff, newContact, reservationBody, resetDatabase } from "../test/helpers.js";
import { RETENTION_DAYS, anonymizeOld } from "./anonymize.js";
import { buildApp } from "./app.js";
import { loggerOptions, safeUrl } from "./logging.js";

const pool = new pg.Pool({ connectionString: testDatabaseUrl });

afterAll(() => pool.end());
beforeEach(async () => {
  await resetDatabase(pool);
  await pool.query("INSERT INTO tables (number, capacity) VALUES (1, 4)");
});

describe("rate limit", () => {
  it("limita as tentativas de login por IP", async () => {
    await createStaff(pool);
    const app = buildApp(pool, { now: () => NOW, rateLimit: true });
    const login = (password: string) =>
      app.inject({ method: "POST", url: "/api/auth/login", payload: { email: STAFF.email, password } });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt++) statuses.push((await login("errada")).statusCode);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    expect((await login(STAFF.password)).statusCode).toBe(429);
    await app.close();
  });

  it("limita a criação de reservas por IP", async () => {
    const app = buildApp(pool, { now: () => NOW, rateLimit: true });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await app.inject({ method: "POST", url: "/api/reservations", payload: { name: "" } });
      statuses.push(response.statusCode);
    }

    expect(statuses.filter((status) => status === 429)).toHaveLength(2);
    await app.close();
  });

  it("limita a consulta de disponibilidade por IP", async () => {
    const app = buildApp(pool, { now: () => NOW, rateLimit: true });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 62; attempt++) {
      statuses.push((await app.inject({ method: "GET", url: "/api/availability?date=2026-11-10&partySize=2" })).statusCode);
    }

    expect(statuses.filter((status) => status === 429)).toHaveLength(2);
    await app.close();
  });

  it("fica desligado por padrão (os outros testes dependem disso)", async () => {
    const app = buildApp(pool, { now: () => NOW });

    for (let attempt = 0; attempt < 8; attempt++) {
      expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@b.co", password: "x" } })).statusCode).toBe(401);
    }
    await app.close();
  });
});

describe("logs sem dado pessoal", () => {
  it("tira o segredo do link e a busca da URL", () => {
    expect(safeUrl("/api/reservations/manage/AbCdEf123_-token/cancel")).toBe("/api/reservations/manage/:token/cancel");
    expect(safeUrl("/api/staff/reservations?q=Maria%20Silva&date=2026-11-10")).toBe("/api/staff/reservations");
  });

  it("o log JSON de uma requisição não leva token, busca, cookie nem corpo", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const app = Fastify({ logger: { ...loggerOptions, stream } });
    app.get("/api/reservations/manage/:token", async () => ({ ok: true }));
    await app.inject({
      method: "GET",
      url: "/api/reservations/manage/SEGREDO-do-link-123456?q=Maria",
      headers: { cookie: "session=SEGREDO-da-sessao" },
    });

    const log = lines.join("\n");
    expect(log).toContain("/api/reservations/manage/:token");
    for (const secret of ["SEGREDO-do-link", "Maria", "SEGREDO-da-sessao"]) expect(log).not.toContain(secret);
    await app.close();
  });
});

describe("anonimização (LGPD)", () => {
  const insert = async (endsAt: string, status = "confirmed") => {
    const contact = newContact();
    const startsAt = new Date(new Date(endsAt).getTime() - 2 * 3600_000);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email, notes, status, manage_token_hash)
       VALUES (1, $1, $2, 2, 'Ana Souza', $3, $4, 'sem glúten', $5, $6) RETURNING id`,
      [startsAt, endsAt, contact.phone, contact.email, status, `hash-${endsAt}-${status}`],
    );
    return rows[0]!.id;
  };

  it("apaga os dados pessoais só das reservas com mais de 180 dias, e mantém a linha", async () => {
    const oldId = await insert("2026-04-01T22:00:00Z", "completed");
    const recentId = await insert("2026-10-01T22:00:00Z", "completed");

    expect(await anonymizeOld(pool, NOW)).toBe(1);

    const { rows } = await pool.query("SELECT id, name, phone, email, notes, manage_token_hash, anonymized_at, status, party_size FROM reservations ORDER BY id");
    const old = rows.find((row) => row.id === oldId);
    const recent = rows.find((row) => row.id === recentId);
    expect(old).toMatchObject({ name: "Anonimizado", phone: "", email: "", notes: null, manage_token_hash: null, status: "completed", party_size: 2 });
    expect(old.anonymized_at).not.toBeNull();
    expect(recent).toMatchObject({ name: "Ana Souza", notes: "sem glúten" });
  });

  it("não mexe de novo no que já foi anonimizado e respeita o limite de dias", async () => {
    await insert("2026-04-01T22:00:00Z", "no_show");

    expect(await anonymizeOld(pool, NOW)).toBe(1);
    expect(await anonymizeOld(pool, NOW)).toBe(0);
    expect(RETENTION_DAYS).toBe(180);
  });

  it("o link de gerenciamento de uma reserva anonimizada deixa de funcionar", async () => {
    const app = buildApp(pool, { now: () => NOW });
    const created = (await app.inject({ method: "POST", url: "/api/reservations", payload: reservationBody() })).json();
    await pool.query("UPDATE reservations SET starts_at = starts_at - interval '300 days', ends_at = ends_at - interval '300 days' WHERE id = $1", [created.id]);

    await anonymizeOld(pool, NOW);

    expect((await app.inject({ method: "GET", url: `/api/reservations/manage/${created.manageToken}` })).statusCode).toBe(404);
    await app.close();
  });

  it("várias reservas anonimizadas não colidem nos índices de contato", async () => {
    for (let index = 0; index < 3; index++) await insert(`2026-03-0${index + 1}T22:00:00Z`);

    await expect(anonymizeOld(pool, NOW)).resolves.toBe(3);
  });
});
