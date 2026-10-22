import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, newContact, reservationBody, resetDatabase } from "../../test/helpers.js";
import { buildApp } from "../app.js";

const { app, pool, sent, close } = createTestApp();

afterAll(close);

beforeEach(async () => {
  await resetDatabase(pool);
  await pool.query("INSERT INTO tables (number, capacity) VALUES (1, 2), (2, 4), (3, 8)");
  sent.length = 0;
});

const post = (body: object) => app.inject({ method: "POST", url: "/api/reservations", payload: body });
const manage = (token: string) => app.inject({ method: "GET", url: `/api/reservations/manage/${token}` });
const cancel = (token: string) => app.inject({ method: "POST", url: `/api/reservations/manage/${token}/cancel` });

describe("criação e link de gerenciamento", () => {
  it("devolve o token do link e guarda só o hash", async () => {
    const response = await post(reservationBody());
    const { manageToken, id } = response.json();

    expect(response.statusCode).toBe(201);
    expect(manageToken.length).toBeGreaterThanOrEqual(32);
    const { rows } = await pool.query("SELECT manage_token_hash FROM reservations WHERE id = $1", [id]);
    expect(rows[0].manage_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].manage_token_hash).not.toContain(manageToken);
  });

  it("envia e-mail de confirmação com o link e o arquivo .ics", async () => {
    const body = reservationBody();
    const { manageToken } = (await post(body)).json();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: body.email, subject: "Reserva confirmada" });
    expect(sent[0]!.text).toContain(`https://reservas.test/reserva/${manageToken}`);
    expect(sent[0]!.attachments?.[0]?.content).toContain("BEGIN:VEVENT");
  });

  it("falha no envio do e-mail não desfaz a reserva", async () => {
    const failing = buildApp(pool, {
      now: () => new Date("2026-11-08T12:00:00-03:00"),
      mailer: { send: async () => Promise.reject(new Error("SMTP fora do ar")) },
    });
    const response = await failing.inject({ method: "POST", url: "/api/reservations", payload: reservationBody() });

    expect(response.statusCode).toBe(201);
    expect((await pool.query("SELECT 1 FROM reservations")).rowCount).toBe(1);
    await failing.close();
  });
});

describe("1 reserva ativa por contato e turno", () => {
  it("recusa o mesmo e-mail no mesmo turno", async () => {
    const contact = newContact();
    await post(reservationBody(contact));

    const again = await post(
      reservationBody({ ...contact, phone: "(11) 98888-7777", startsAt: "2026-11-10T20:00:00-03:00" }),
    );

    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: "already_reserved" });
  });

  it("recusa o mesmo telefone, mesmo escrito de outro jeito", async () => {
    await post(reservationBody({ phone: "(11) 97777-6666" }));

    const again = await post(reservationBody({ phone: "11 97777 6666" }));

    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: "already_reserved" });
  });

  it("aceita o mesmo contato em outro turno ou outro dia", async () => {
    const contact = newContact();
    await post(reservationBody({ ...contact, startsAt: "2026-11-10T12:00:00-03:00" }));

    expect((await post(reservationBody({ ...contact, startsAt: "2026-11-10T19:00:00-03:00" }))).statusCode).toBe(201);
    expect((await post(reservationBody({ ...contact, startsAt: "2026-11-11T19:00:00-03:00" }))).statusCode).toBe(201);
  });

  it("reserva cancelada libera o contato", async () => {
    const contact = newContact();
    const first = (await post(reservationBody(contact))).json();
    await cancel(first.manageToken);

    expect((await post(reservationBody(contact))).statusCode).toBe(201);
  });

  it("de 5 pedidos simultâneos do mesmo contato, só 1 é criado", async () => {
    const contact = newContact();
    const responses = await Promise.all(Array.from({ length: 5 }, () => post(reservationBody(contact))));

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409, 409, 409]);
  });
});

describe("GET /api/reservations/manage/:token", () => {
  it("mostra a reserva e o prazo de cancelamento, sem e-mail nem telefone", async () => {
    const { manageToken } = (await post(reservationBody({ name: "Bia" }))).json();

    const response = await manage(manageToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "confirmed",
      name: "Bia",
      partySize: 2,
      canCancel: true,
      cancelDeadline: "2026-11-10T20:00:00.000Z",
    });
    expect(response.json()).not.toHaveProperty("email");
    expect(response.json()).not.toHaveProperty("phone");
  });

  it("responde 404 para token desconhecido", async () => {
    expect((await manage("x".repeat(32))).statusCode).toBe(404);
  });
});

describe("POST /api/reservations/manage/:token/cancel", () => {
  it("cancela, libera a mesa e avisa por e-mail", async () => {
    const { manageToken, id } = (await post(reservationBody({ partySize: 8 }))).json();
    sent.length = 0;

    const response = await cancel(manageToken);

    expect(response.json()).toEqual({ status: "cancelled" });
    const { rows } = await pool.query("SELECT status, cancelled_by FROM reservations WHERE id = $1", [id]);
    expect(rows[0]).toEqual({ status: "cancelled", cancelled_by: "customer" });
    expect((await post(reservationBody({ partySize: 8 }))).statusCode).toBe(201);
    expect(sent.find((email) => email.subject === "Reserva cancelada")).toBeDefined();
  });

  it("não cancela com menos de 2h de antecedência", async () => {
    const { manageToken } = (await post(reservationBody({ startsAt: "2026-11-10T19:00:00-03:00" }))).json();
    const late = createTestApp(() => new Date("2026-11-10T17:30:00-03:00"));

    const response = await late.app.inject({ method: "POST", url: `/api/reservations/manage/${manageToken}/cancel` });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "too_late_to_cancel" });
    await late.close();
  });

  it("cancela exatamente 2h antes", async () => {
    const { manageToken } = (await post(reservationBody({ startsAt: "2026-11-10T19:00:00-03:00" }))).json();
    const edge = createTestApp(() => new Date("2026-11-10T17:00:00-03:00"));

    const response = await edge.app.inject({ method: "POST", url: `/api/reservations/manage/${manageToken}/cancel` });

    expect(response.statusCode).toBe(200);
    await edge.close();
  });

  it("não cancela duas vezes", async () => {
    const { manageToken } = (await post(reservationBody())).json();
    await cancel(manageToken);

    expect((await cancel(manageToken)).json()).toEqual({ error: "not_active" });
  });

  it("responde 404 para token desconhecido", async () => {
    expect((await cancel("y".repeat(32))).statusCode).toBe(404);
  });
});

describe("GET /api/config", () => {
  it("expõe as regras públicas e a maior mesa ativa", async () => {
    const response = await app.inject({ method: "GET", url: "/api/config" });

    expect(response.json()).toMatchObject({
      durationMinutes: 120,
      cancelMinAdvanceMinutes: 120,
      closedWeekdays: [1],
      maxPartySize: 8,
    });
  });

  it("maxPartySize ignora mesas desativadas", async () => {
    await pool.query("UPDATE tables SET active = false WHERE capacity = 8");

    expect((await app.inject({ method: "GET", url: "/api/config" })).json().maxPartySize).toBe(4);
  });
});
