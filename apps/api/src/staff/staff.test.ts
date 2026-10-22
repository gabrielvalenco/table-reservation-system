import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  STAFF,
  createStaff,
  createTestApp,
  newContact,
  reservationBody,
  resetDatabase,
} from "../../test/helpers.js";

const { app, pool, sent, close } = createTestApp();

afterAll(close);

let cookies: Record<string, string>;

beforeEach(async () => {
  await resetDatabase(pool);
  await pool.query("INSERT INTO tables (number, capacity) VALUES (1, 2), (2, 4), (3, 8)");
  await createStaff(pool);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: STAFF.email, password: STAFF.password },
  });
  cookies = { session: login.cookies.find((cookie) => cookie.name === "session")!.value };
  sent.length = 0;
});

const call = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
  app.inject({ method, url, payload, cookies });

const publicPost = (body: object) => app.inject({ method: "POST", url: "/api/reservations", payload: body });

describe("sessão", () => {
  it("recusa rotas da equipe sem login", async () => {
    for (const url of ["/api/staff/reservations?date=2026-11-10", "/api/staff/tables", "/api/staff/stats", "/api/auth/me"]) {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    }
  });

  it("recusa senha errada e e-mail desconhecido com a mesma resposta", async () => {
    const wrong = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: STAFF.email, password: "errada" } });
    const unknown = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "outro@example.com", password: "qualquer" } });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it("o login entrega um cookie HttpOnly e SameSite=Strict, e guarda só o hash da sessão", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: STAFF.email.toUpperCase(), password: STAFF.password },
    });
    const cookie = login.cookies.find((item) => item.name === "session")!;

    expect(login.statusCode).toBe(200);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
    const { rows } = await pool.query("SELECT token_hash FROM staff_sessions WHERE token_hash = $1", [cookie.value]);
    expect(rows).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { session: cookie.value } })).json()).toMatchObject({
      email: STAFF.email,
    });
  });

  it("o logout encerra a sessão", async () => {
    await call("POST", "/api/auth/logout");

    expect((await call("GET", "/api/auth/me")).statusCode).toBe(401);
  });

  it("sessão vencida é recusada", async () => {
    await pool.query("UPDATE staff_sessions SET expires_at = '2020-01-01'");

    expect((await call("GET", "/api/auth/me")).statusCode).toBe(401);
  });

  it("usuário desativado perde o acesso", async () => {
    await pool.query("UPDATE staff_users SET active = false");

    expect((await call("GET", "/api/auth/me")).statusCode).toBe(401);
  });
});

describe("agenda", () => {
  it("lista as reservas do dia com a mesa, em ordem de horário", async () => {
    await publicPost(reservationBody({ name: "Tarde", startsAt: "2026-11-10T21:00:00-03:00" }));
    await publicPost(reservationBody({ name: "Cedo", startsAt: "2026-11-10T18:00:00-03:00" }));
    await publicPost(reservationBody({ name: "Outro dia", startsAt: "2026-11-11T19:00:00-03:00" }));

    const rows = (await call("GET", "/api/staff/reservations?date=2026-11-10")).json();

    expect(rows.map((row: { name: string }) => row.name)).toEqual(["Cedo", "Tarde"]);
    expect(rows[0]).toMatchObject({ tableNumber: 1, tableCapacity: 2, status: "confirmed" });
  });

  it("filtra por status", async () => {
    const { manageToken } = (await publicPost(reservationBody({ name: "Cancelada" }))).json();
    await app.inject({ method: "POST", url: `/api/reservations/manage/${manageToken}/cancel` });
    await publicPost(reservationBody({ name: "Ativa" }));

    const rows = (await call("GET", "/api/staff/reservations?date=2026-11-10&status=cancelled")).json();

    expect(rows.map((row: { name: string }) => row.name)).toEqual(["Cancelada"]);
  });

  it("busca por nome, e-mail e telefone em qualquer data", async () => {
    await publicPost(reservationBody({ name: "Maria Oliveira", email: "maria@example.com", phone: "(11) 93333-4444" }));
    await publicPost(reservationBody({ name: "João", startsAt: "2026-11-12T19:00:00-03:00" }));

    const find = async (q: string) =>
      (await call("GET", `/api/staff/reservations?q=${encodeURIComponent(q)}`)).json().map((row: { name: string }) => row.name);

    expect(await find("oliveira")).toEqual(["Maria Oliveira"]);
    expect(await find("maria@")).toEqual(["Maria Oliveira"]);
    expect(await find("93333")).toEqual(["Maria Oliveira"]);
    expect(await find("%")).toEqual([]);
  });

  it("exige a data ou uma busca", async () => {
    expect((await call("GET", "/api/staff/reservations")).statusCode).toBe(400);
  });
});

describe("criar reserva", () => {
  it("a equipe reserva em cima da hora, o que o cliente não pode", async () => {
    const soon = "2026-11-08T12:30:00-03:00";
    expect((await publicPost(reservationBody({ startsAt: soon }))).json()).toEqual({ error: "too_soon" });

    const response = await call("POST", "/api/staff/reservations", reservationBody({ startsAt: "2026-11-10T12:00:00-03:00" }));
    expect(response.statusCode).toBe(201);

    // A sessão do beforeEach vence em 12h; estes testes avançam o relógio, então ela precisa durar mais.
    await pool.query("UPDATE staff_sessions SET expires_at = '2030-01-01'");
    const walkIn = createTestApp(() => new Date("2026-11-10T11:50:00-03:00"));
    const cookie = { session: cookies.session! };
    const quick = await walkIn.app.inject({
      method: "POST",
      url: "/api/staff/reservations",
      payload: reservationBody({ startsAt: "2026-11-10T12:00:00-03:00", partySize: 4 }),
      cookies: cookie,
    });
    expect(quick.statusCode).toBe(201);
    await walkIn.close();
  });

  it("escolhe a mesa pedida e manda o e-mail de confirmação", async () => {
    const response = await call("POST", "/api/staff/reservations", reservationBody({ tableId: 3 }));

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ tableNumber: 3, tableCapacity: 8 });
    expect(sent.at(-1)?.subject).toBe("Reserva confirmada");
  });

  it("recusa mesa pequena, ocupada ou desativada", async () => {
    await call("POST", "/api/staff/reservations", reservationBody({ tableId: 2 }));
    await pool.query("UPDATE tables SET active = false WHERE id = 3");

    expect((await call("POST", "/api/staff/reservations", reservationBody({ tableId: 1, partySize: 4 }))).json()).toEqual({ error: "table_too_small" });
    expect((await call("POST", "/api/staff/reservations", reservationBody({ tableId: 2 }))).json()).toEqual({ error: "table_unavailable" });
    expect((await call("POST", "/api/staff/reservations", reservationBody({ tableId: 3 }))).json()).toEqual({ error: "table_unavailable" });
  });

  it("recusa horário fora do turno", async () => {
    const response = await call("POST", "/api/staff/reservations", reservationBody({ startsAt: "2026-11-10T16:00:00-03:00" }));

    expect(response.json()).toEqual({ error: "closed" });
  });
});

describe("editar reserva", () => {
  const create = async (overrides: object = {}) =>
    (await call("POST", "/api/staff/reservations", reservationBody(overrides))).json();

  it("troca a mesa", async () => {
    const reservation = await create({ tableId: 2 });

    const response = await call("PATCH", `/api/staff/reservations/${reservation.id}`, { tableId: 3 });

    expect(response.json()).toMatchObject({ tableNumber: 3 });
  });

  it("não troca para mesa ocupada, pequena ou desativada", async () => {
    const reservation = await create({ tableId: 2, partySize: 3 });
    await create({ tableId: 3, partySize: 5, email: "outro@example.com", phone: "(11) 90000-1111" });

    const patch = (body: object) => call("PATCH", `/api/staff/reservations/${reservation.id}`, body);

    expect((await patch({ tableId: 3 })).json()).toEqual({ error: "table_unavailable" });
    expect((await patch({ tableId: 1 })).json()).toEqual({ error: "table_too_small" });
    await pool.query("UPDATE tables SET active = false WHERE id = 1");
    expect((await patch({ tableId: 1 })).json()).toEqual({ error: "table_unavailable" });
  });

  it("não deixa o grupo passar da capacidade da mesa", async () => {
    const reservation = await create({ tableId: 1 });

    const response = await call("PATCH", `/api/staff/reservations/${reservation.id}`, { partySize: 3 });

    expect(response.json()).toEqual({ error: "table_too_small" });
  });

  it("muda horário e dados de contato", async () => {
    const reservation = await create({ tableId: 2 });

    const response = await call("PATCH", `/api/staff/reservations/${reservation.id}`, {
      startsAt: "2026-11-10T20:00:00-03:00",
      name: "Novo Nome",
      notes: "Aniversário",
    });

    expect(response.json()).toMatchObject({
      name: "Novo Nome",
      notes: "Aniversário",
      startsAt: "2026-11-10T23:00:00.000Z",
      endsAt: "2026-11-11T01:00:00.000Z",
    });
  });

  it("marca como concluída e como não compareceu", async () => {
    const done = await create({ tableId: 1 });
    const missed = await create({ tableId: 2 });

    expect((await call("PATCH", `/api/staff/reservations/${done.id}`, { status: "completed" })).json().status).toBe("completed");
    expect((await call("PATCH", `/api/staff/reservations/${missed.id}`, { status: "no_show" })).json().status).toBe("no_show");
  });

  it("cancela a qualquer hora, registra quem cancelou e avisa o cliente", async () => {
    const reservation = await create({ tableId: 1, startsAt: "2026-11-10T19:00:00-03:00" });
    sent.length = 0;
    await pool.query("UPDATE staff_sessions SET expires_at = '2030-01-01'");
    const late = createTestApp(() => new Date("2026-11-10T18:30:00-03:00"));

    const response = await late.app.inject({
      method: "PATCH",
      url: `/api/staff/reservations/${reservation.id}`,
      payload: { status: "cancelled" },
      cookies: { session: cookies.session! },
    });

    expect(response.json()).toMatchObject({ status: "cancelled", cancelledBy: "staff" });
    await late.close();
  });

  it("e-mail de cancelamento sai quando a equipe cancela", async () => {
    const reservation = await create({ tableId: 1 });
    sent.length = 0;

    await call("PATCH", `/api/staff/reservations/${reservation.id}`, { status: "cancelled" });

    expect(sent.map((email) => email.subject)).toEqual(["Reserva cancelada"]);
  });

  it("reserva que não está confirmada não pode mais ser alterada", async () => {
    const reservation = await create({ tableId: 1 });
    await call("PATCH", `/api/staff/reservations/${reservation.id}`, { status: "completed" });

    const response = await call("PATCH", `/api/staff/reservations/${reservation.id}`, { name: "Outro" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "not_editable" });
  });

  it("responde 404 para reserva inexistente e 400 para corpo vazio", async () => {
    expect((await call("PATCH", "/api/staff/reservations/00000000-0000-4000-8000-000000000000", { name: "X" })).statusCode).toBe(404);
    const reservation = await create();
    expect((await call("PATCH", `/api/staff/reservations/${reservation.id}`, {})).statusCode).toBe(400);
  });
});

describe("mesas", () => {
  it("lista as mesas com as reservas futuras de cada uma", async () => {
    await call("POST", "/api/staff/reservations", reservationBody({ tableId: 2, startsAt: "2030-01-15T19:00:00-03:00" }));

    const tables = (await call("GET", "/api/staff/tables")).json();

    expect(tables.map((table: { number: number }) => table.number)).toEqual([1, 2, 3]);
    expect(tables[1]).toMatchObject({ capacity: 4, active: true, upcomingReservations: 1 });
    expect(tables[0].upcomingReservations).toBe(0);
  });

  it("cria mesa e recusa número repetido", async () => {
    const created = await call("POST", "/api/staff/tables", { number: 4, capacity: 6 });
    const repeated = await call("POST", "/api/staff/tables", { number: 4, capacity: 2 });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ number: 4, capacity: 6, active: true });
    expect(repeated.statusCode).toBe(409);
    expect(repeated.json()).toEqual({ error: "number_taken" });
  });

  it("valida o corpo", async () => {
    expect((await call("POST", "/api/staff/tables", { number: 0, capacity: 2 })).statusCode).toBe(400);
    expect((await call("PATCH", "/api/staff/tables/1", {})).statusCode).toBe(400);
  });

  it("desativar a mesa tira o horário da disponibilidade e aponta as reservas afetadas", async () => {
    const reservation = (await call("POST", "/api/staff/reservations", reservationBody({ tableId: 3, startsAt: "2030-01-15T19:00:00-03:00" }))).json();

    const response = await call("PATCH", "/api/staff/tables/3", { active: false });

    expect(response.json().table).toMatchObject({ id: 3, active: false });
    expect(response.json().affectedReservations.map((item: { id: string }) => item.id)).toEqual([reservation.id]);
    const config = (await app.inject({ method: "GET", url: "/api/config" })).json();
    expect(config.maxPartySize).toBe(4);
  });

  it("reduzir a capacidade aponta as reservas que deixaram de caber", async () => {
    const reservation = (await call("POST", "/api/staff/reservations", reservationBody({ tableId: 3, partySize: 6, startsAt: "2030-01-15T19:00:00-03:00" }))).json();

    const response = await call("PATCH", "/api/staff/tables/3", { capacity: 4 });

    expect(response.json().affectedReservations.map((item: { id: string }) => item.id)).toEqual([reservation.id]);
  });

  it("responde 404 para mesa inexistente", async () => {
    expect((await call("PATCH", "/api/staff/tables/999", { active: false })).statusCode).toBe(404);
  });
});

describe("painel", () => {
  it("resume os últimos dias: totais, no-show, turnos e dias da semana", async () => {
    const create = async (overrides: object) => (await call("POST", "/api/staff/reservations", reservationBody(overrides))).json();
    const a = await create({ tableId: 1, startsAt: "2026-11-03T12:00:00-03:00" });
    const b = await create({ tableId: 2, startsAt: "2026-11-03T19:00:00-03:00", partySize: 4 });
    const c = await create({ tableId: 3, startsAt: "2026-11-04T19:00:00-03:00", partySize: 6 });
    const d = await create({ tableId: 1, startsAt: "2026-11-05T19:00:00-03:00" });
    await call("PATCH", `/api/staff/reservations/${a.id}`, { status: "completed" });
    await call("PATCH", `/api/staff/reservations/${b.id}`, { status: "completed" });
    await call("PATCH", `/api/staff/reservations/${c.id}`, { status: "no_show" });
    await call("PATCH", `/api/staff/reservations/${d.id}`, { status: "cancelled" });

    const stats = (await call("GET", "/api/staff/stats?days=30")).json();

    expect(stats.totals).toEqual({ confirmed: 0, cancelled: 1, completed: 2, no_show: 1 });
    expect(stats.noShowRate).toBeCloseTo(1 / 3);
    expect(stats.cancellationRate).toBeCloseTo(1 / 4);
    expect(stats.byShift).toEqual([
      { shift: "lunch", reservations: 1, guests: 2 },
      { shift: "dinner", reservations: 2, guests: 10 },
    ]);
    expect(stats.byWeekday).toEqual([
      { weekday: 2, reservations: 2 },
      { weekday: 3, reservations: 1 },
    ]);
  });

  it("sem reservas, as taxas são nulas", async () => {
    const stats = (await call("GET", "/api/staff/stats")).json();

    expect(stats.noShowRate).toBeNull();
    expect(stats.cancellationRate).toBeNull();
  });
});

describe("contato único também vale para a equipe", () => {
  it("recusa segunda reserva ativa do mesmo contato no turno", async () => {
    const contact = newContact();
    await call("POST", "/api/staff/reservations", reservationBody(contact));

    const again = await call("POST", "/api/staff/reservations", reservationBody(contact));

    expect(again.json()).toEqual({ error: "already_reserved" });
  });
});
