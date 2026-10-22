import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import pg from "pg";
import { z } from "zod";
import {
  createTableBody,
  loginBody,
  staffCreateReservationBody,
  staffReservationsQuery,
  updateReservationBody,
  updateTableBody,
  type StaffUser,
  type StatsResponse,
} from "@reservas/shared";
import { cancellationEmail, confirmationEmail, sendInBackground, type Mailer } from "../mail.js";
import { bookReservation } from "../reservations/booking.js";
import { checkSlot, dayRange, endOf } from "../reservations/rules.js";
import { hashToken, newToken, verifyPassword } from "../security.js";

declare module "fastify" {
  interface FastifyRequest {
    staff?: StaffUser;
  }
}

type Options = { pool: pg.Pool; now: () => Date; mailer: Mailer; publicUrl: string; production: boolean };

const SESSION_COOKIE = "session";
const SESSION_HOURS = 12;

const loginLimit = { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } };

const reservationSelect = `
  SELECT r.id, r.table_id AS "tableId", t.number AS "tableNumber", t.capacity AS "tableCapacity", t.active AS "tableActive",
         r.starts_at AS "startsAt", r.ends_at AS "endsAt", r.party_size AS "partySize",
         r.name, r.phone, r.email, r.notes, r.status, r.cancelled_by AS "cancelledBy", r.created_at AS "createdAt"
  FROM reservations r JOIN tables t ON t.id = r.table_id`;

const idParams = z.object({ id: z.uuid() });
const tableIdParams = z.object({ id: z.coerce.number().int().positive() });

export const staffRoutes: FastifyPluginAsync<Options> = async (app, { pool, now, mailer, publicUrl, production }) => {
  const mail = (email: Parameters<Mailer["send"]>[0]) => sendInBackground(mailer, app.log, email);

  async function requireStaff(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const { rows } = await pool.query<StaffUser>(
        `SELECT u.id, u.email, u.name FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > $2 AND u.active`,
        [hashToken(token), now()],
      );
      if (rows[0]) {
        request.staff = rows[0];
        return;
      }
    }
    return reply.code(401).send({ error: "unauthorized" });
  }

  const auth = { preHandler: requireStaff };

  // --- Sessão ---

  app.post("/auth/login", loginLimit, async (request, reply) => {
    const body = loginBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows } = await pool.query<StaffUser & { passwordHash: string }>(
      `SELECT id, email, name, password_hash AS "passwordHash" FROM staff_users WHERE lower(email) = lower($1) AND active`,
      [body.data.email],
    );
    const user = rows[0];
    if (!(await verifyPassword(user?.passwordHash, body.data.password)) || !user) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = newToken();
    const expiresAt = new Date(now().getTime() + SESSION_HOURS * 3600_000);
    await pool.query("INSERT INTO staff_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
      hashToken(token),
      user.id,
      expiresAt,
    ]);
    // Sessões vencidas de qualquer usuário saem do banco no login.
    await pool.query("DELETE FROM staff_sessions WHERE expires_at < $1", [now()]);

    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: production,
      path: "/",
      expires: expiresAt,
    });
    return { id: user.id, email: user.email, name: user.name };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await pool.query("DELETE FROM staff_sessions WHERE token_hash = $1", [hashToken(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/me", auth, async (request) => request.staff);

  // --- Reservas ---

  app.get("/staff/reservations", auth, async (request, reply) => {
    const query = staffReservationsQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query", issues: query.error.issues });

    const { date, status, q } = query.data;
    const conditions: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => `$${params.push(value)}`;

    if (date) {
      const { start, end } = dayRange(date);
      conditions.push(`r.starts_at >= ${param(start)} AND r.starts_at < ${param(end)}`);
    }
    if (status) conditions.push(`r.status = ${param(status)}`);
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      const digits = q.replace(/\D/g, "");
      const phoneMatch = digits.length >= 4 ? ` OR regexp_replace(r.phone, '\\D', '', 'g') LIKE ${param(`%${digits}%`)}` : "";
      conditions.push(`(r.name ILIKE ${param(like)} OR r.email ILIKE ${param(like)}${phoneMatch})`);
    }

    const { rows } = await pool.query(
      `${reservationSelect} WHERE ${conditions.join(" AND ")} ORDER BY r.starts_at, t.number LIMIT 200`,
      params,
    );
    return rows;
  });

  app.post("/staff/reservations", auth, async (request, reply) => {
    const body = staffCreateReservationBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    const { name, phone, email, partySize, notes, tableId } = body.data;
    const startsAt = new Date(body.data.startsAt);
    const endsAt = endOf(startsAt);

    // A equipe pode reservar com pouca antecedência (cliente na porta, telefone), mas o horário precisa ser válido.
    const slotError = checkSlot(startsAt, now(), { ignoreAdvance: true });
    if (slotError) return reply.code(400).send({ error: slotError });

    const result = await bookReservation(pool, { startsAt, endsAt, partySize, name, phone, email, notes, tableId });
    if (!result.ok) return reply.code(409).send({ error: result.error });

    mail(confirmationEmail({ name, email, startsAt, endsAt, partySize }, result.id, `${publicUrl}/reserva/${result.token}`));
    const { rows } = await pool.query(`${reservationSelect} WHERE r.id = $1`, [result.id]);
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string } }>("/staff/reservations/:id", auth, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = updateReservationBody.safeParse(request.body);
    if (!params.success) return reply.code(404).send({ error: "not_found" });
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    const { rows: current } = await pool.query(`${reservationSelect} WHERE r.id = $1`, [params.data.id]);
    const reservation = current[0];
    if (!reservation) return reply.code(404).send({ error: "not_found" });
    if (reservation.status !== "confirmed") return reply.code(409).send({ error: "not_editable" });

    const change = body.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => sets.push(`${column} = $${values.push(value)}`);

    if (change.name !== undefined) set("name", change.name);
    if (change.phone !== undefined) set("phone", change.phone);
    if (change.email !== undefined) set("email", change.email);
    if (change.notes !== undefined) set("notes", change.notes);

    const partySize = change.partySize ?? reservation.partySize;
    if (change.partySize !== undefined) set("party_size", partySize);

    if (change.startsAt !== undefined) {
      const startsAt = new Date(change.startsAt);
      const slotError = checkSlot(startsAt, now(), { ignoreAdvance: true });
      if (slotError) return reply.code(400).send({ error: slotError });
      set("starts_at", startsAt);
      set("ends_at", endOf(startsAt));
    }

    // A mesa precisa estar ativa e comportar o grupo, quer a mesa ou o grupo tenham mudado.
    if (change.tableId !== undefined || change.partySize !== undefined) {
      const tableId = change.tableId ?? reservation.tableId;
      const { rows } = await pool.query<{ capacity: number; active: boolean }>(
        "SELECT capacity, active FROM tables WHERE id = $1",
        [tableId],
      );
      const table = rows[0];
      if (!table || (change.tableId !== undefined && !table.active)) {
        return reply.code(409).send({ error: "table_unavailable" });
      }
      if (table.capacity < partySize) return reply.code(409).send({ error: "table_too_small" });
      if (change.tableId !== undefined) set("table_id", tableId);
    }

    if (change.status !== undefined) {
      set("status", change.status);
      if (change.status === "cancelled") {
        set("cancelled_at", now());
        set("cancelled_by", "staff");
      }
    }

    try {
      await pool.query(`UPDATE reservations SET ${sets.join(", ")} WHERE id = $${values.push(reservation.id)}`, values);
    } catch (error) {
      if (error instanceof pg.DatabaseError && error.code === "23P01") {
        return reply.code(409).send({ error: "table_unavailable" });
      }
      if (error instanceof pg.DatabaseError && error.code === "23505") {
        return reply.code(409).send({ error: "already_reserved" });
      }
      throw error;
    }

    const { rows } = await pool.query(`${reservationSelect} WHERE r.id = $1`, [reservation.id]);
    if (change.status === "cancelled") {
      mail(
        cancellationEmail({
          name: rows[0].name,
          email: rows[0].email,
          startsAt: rows[0].startsAt,
          endsAt: rows[0].endsAt,
          partySize: rows[0].partySize,
        }),
      );
    }
    return rows[0];
  });

  // --- Mesas ---

  const tableSelect = `
    SELECT t.id, t.number, t.capacity, t.active,
           (SELECT count(*)::int FROM reservations r
            WHERE r.table_id = t.id AND r.status = 'confirmed' AND r.ends_at > now()) AS "upcomingReservations"
    FROM tables t`;

  app.get("/staff/tables", auth, async () => (await pool.query(`${tableSelect} ORDER BY t.number`)).rows);

  app.post("/staff/tables", auth, async (request, reply) => {
    const body = createTableBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    try {
      const { rows } = await pool.query<{ id: number }>(
        "INSERT INTO tables (number, capacity) VALUES ($1, $2) RETURNING id",
        [body.data.number, body.data.capacity],
      );
      const created = await pool.query(`${tableSelect} WHERE t.id = $1`, [rows[0]!.id]);
      return reply.code(201).send(created.rows[0]);
    } catch (error) {
      if (error instanceof pg.DatabaseError && error.code === "23505") {
        return reply.code(409).send({ error: "number_taken" });
      }
      throw error;
    }
  });

  // Mesas não são apagadas: desativar impede reservas novas e as existentes continuam na agenda.
  app.patch<{ Params: { id: string } }>("/staff/tables/:id", auth, async (request, reply) => {
    const params = tableIdParams.safeParse(request.params);
    const body = updateTableBody.safeParse(request.body);
    if (!params.success) return reply.code(404).send({ error: "not_found" });
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.data.number !== undefined) sets.push(`number = $${values.push(body.data.number)}`);
    if (body.data.capacity !== undefined) sets.push(`capacity = $${values.push(body.data.capacity)}`);
    if (body.data.active !== undefined) sets.push(`active = $${values.push(body.data.active)}`);

    try {
      const { rowCount } = await pool.query(
        `UPDATE tables SET ${sets.join(", ")} WHERE id = $${values.push(params.data.id)}`,
        values,
      );
      if (rowCount === 0) return reply.code(404).send({ error: "not_found" });
    } catch (error) {
      if (error instanceof pg.DatabaseError && error.code === "23505") {
        return reply.code(409).send({ error: "number_taken" });
      }
      throw error;
    }

    // Reservas futuras que a mudança deixou sem mesa válida: a equipe precisa tratá-las.
    const { rows: affected } = await pool.query(
      `${reservationSelect}
       WHERE r.table_id = $1 AND r.status = 'confirmed' AND r.ends_at > now()
         AND (NOT t.active OR r.party_size > t.capacity)
       ORDER BY r.starts_at`,
      [params.data.id],
    );
    const { rows } = await pool.query(`${tableSelect} WHERE t.id = $1`, [params.data.id]);
    return { table: rows[0], affectedReservations: affected };
  });

  // --- Painel ---

  app.get("/staff/stats", auth, async (request, reply) => {
    const query = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });

    const { days } = query.data;
    const since = new Date(now().getTime() - days * 86_400_000);
    const window = [since, now()];

    const [byStatus, byShift, byWeekday] = await Promise.all([
      pool.query<{ status: string; count: number }>(
        "SELECT status, count(*)::int AS count FROM reservations WHERE starts_at >= $1 AND starts_at < $2 GROUP BY status",
        window,
      ),
      pool.query<{ lunch: boolean; reservations: number; guests: number }>(
        `SELECT (extract(hour FROM starts_at AT TIME ZONE 'America/Sao_Paulo') < 17) AS lunch,
                count(*)::int AS reservations, coalesce(sum(party_size), 0)::int AS guests
         FROM reservations WHERE starts_at >= $1 AND starts_at < $2 AND status <> 'cancelled' GROUP BY 1`,
        window,
      ),
      pool.query<{ weekday: number; reservations: number }>(
        `SELECT extract(dow FROM starts_at AT TIME ZONE 'America/Sao_Paulo')::int AS weekday, count(*)::int AS reservations
         FROM reservations WHERE starts_at >= $1 AND starts_at < $2 AND status <> 'cancelled' GROUP BY 1 ORDER BY 1`,
        window,
      ),
    ]);

    const totals = { confirmed: 0, cancelled: 0, completed: 0, no_show: 0 };
    for (const row of byStatus.rows) totals[row.status as keyof typeof totals] = row.count;

    const attended = totals.completed + totals.no_show;
    const all = totals.confirmed + totals.cancelled + totals.completed + totals.no_show;
    const stats: StatsResponse = {
      days,
      totals,
      noShowRate: attended > 0 ? totals.no_show / attended : null,
      cancellationRate: all > 0 ? totals.cancelled / all : null,
      byShift: (["lunch", "dinner"] as const).map((shift) => {
        const row = byShift.rows.find((item) => item.lunch === (shift === "lunch"));
        return { shift, reservations: row?.reservations ?? 0, guests: row?.guests ?? 0 };
      }),
      byWeekday: byWeekday.rows,
    };
    return stats;
  });
};
